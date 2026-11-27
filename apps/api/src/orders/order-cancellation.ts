import { Prisma } from '../generated/prisma/client';
import { OrderStatus } from './entities/order.entity';

function asObject(value: Prisma.JsonValue | undefined): Prisma.JsonObject | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
}

export async function cancelOrderPayments(
  tx: Prisma.TransactionClient,
  order: { id: number; userId: string; status: string;loyaltyPointsRedeemed?: number; },
): Promise<void> {
  await tx.payment.updateMany({
    where: { orderId: order.id, status: 'PENDING' },
    data: { status: 'EXPIRED', result: { status: 'EXPIRED', reason: 'Đơn hàng đã hủy' } }, 
  });
  // Hoàn lại điểm khách đã sử dụng khi tạo đơn
  const redeemedPoints = order.loyaltyPointsRedeemed ?? 0;

  if (redeemedPoints > 0) {
    const user = await tx.user.update({
      where: { id: order.userId },
      data: {
        loyaltyPoints: {
          increment: redeemedPoints,
        },
      },
      select: {
        loyaltyPoints: true,
      },
    });

    await tx.loyaltyTransaction.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        type: 'ADJUST',
        points: redeemedPoints,
        balanceAfter: user.loyaltyPoints,
        description: `Hoàn ${redeemedPoints} điểm từ đơn #${order.id} đã hủy`,
      },
    });
  }

  if (order.status !== OrderStatus.PAID) return;

  const payments = await tx.payment.findMany({
    where: { orderId: order.id, status: 'PAID' },
  });
  for (const payment of payments) {
    const result = asObject(payment.result);
    const restored = await restoreInventory(tx, result?.inventoryDebits);
    const status = payment.method === 'sepay' ? 'REFUND_PENDING' : 'REFUNDED';
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status,
        result: { ...result, refundStatus: status, inventoryReconciliationRequired: !restored },
      },
    });
  }

  const earned = await tx.loyaltyTransaction.aggregate({
    where: { orderId: order.id, userId: order.userId, type: 'EARN' },
    _sum: { points: true },
  });
  const points = earned._sum.points ?? 0;
  if (points <= 0) return;

  const user = await tx.user.update({
    where: { id: order.userId },
    data: { loyaltyPoints: { decrement: points } },
    select: { loyaltyPoints: true },
  });
  await tx.loyaltyTransaction.create({
    data: {
      userId: order.userId,
      orderId: order.id,
      type: 'ADJUST',
      points: -points,
      balanceAfter: user.loyaltyPoints,
      description: `Thu hồi điểm từ đơn #${order.id} đã hủy`,
    },
  });
}

async function restoreInventory(
  tx: Prisma.TransactionClient,
  value: Prisma.JsonValue | undefined,
): Promise<boolean> {
  const snapshot = asObject(value);
  if (!Array.isArray(snapshot?.cups) || !Array.isArray(snapshot.ingredients)) return false;

  const cups = snapshot.cups.map(asObject);
  const ingredients = snapshot.ingredients.map(asObject);
  for (const cup of cups) {
    if (
      !cup ||
      (cup.size !== 'S' && cup.size !== 'M' && cup.size !== 'L') ||
      typeof cup.quantity !== 'number' || !Number.isSafeInteger(cup.quantity) || cup.quantity <= 0
    ) {
      throw new Error('Invalid cup inventory snapshot');
    }
    await tx.cup.update({
      where: { size: cup.size },
      data: { quantity: { increment: cup.quantity } },
    });
  }
  for (const ingredient of ingredients) {
    if (
      !ingredient ||
      typeof ingredient.id !== 'number' || !Number.isSafeInteger(ingredient.id) ||
      typeof ingredient.quantity !== 'string' || !/^\d+(\.\d+)?$/.test(ingredient.quantity)
    ) {
      throw new Error('Invalid ingredient inventory snapshot');
    }
    await tx.ingredient.update({
      where: { id: ingredient.id },
      data: { quantity: { increment: new Prisma.Decimal(ingredient.quantity) } },
    });
  }
  return true;
}
