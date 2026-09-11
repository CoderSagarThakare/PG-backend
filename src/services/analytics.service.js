const mongoose = require("mongoose");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { PG, Room, Bed, RentPayment, Expense, StaffPayment, Enquiry, BedAssignment, User } = require("../models");

/**
 * Format a Date to 'YYYY-MM'
 */
const toMonthKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

/**
 * Get human-readable month label, e.g. "Sep 2026"
 */
const toMonthLabel = (monthStr) => {
  const [yearStr, monthNumStr] = monthStr.split("-");
  const date = new Date(parseInt(yearStr, 10), parseInt(monthNumStr, 10) - 1, 1);
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
};

/**
 * Generate an array of recent month strings ['YYYY-MM', ...] up to count
 */
const generateMonthRange = (count = 6) => {
  const months = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(toMonthKey(d));
  }
  return months;
};

/**
 * Get consolidated business intelligence & analytics overview for an Owner/Manager
 */
const getOverviewAnalytics = async (user, { pgId, months = 6 }) => {
  const staffId = user._id;

  // 1. Resolve all PGs owned or managed by this user
  const userPgs = await PG.find({
    $or: [{ ownerId: staffId }, { managerId: staffId }],
    isDeleted: false,
  }).sort({ createdAt: -1 });

  if (!userPgs.length) {
    return {
      summary: {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        collectionRate: 0,
        totalCapacity: 0,
        totalOccupied: 0,
        totalEmpty: 0,
        overallOccupancyRate: 0,
        totalLeads: 0,
        conversionRate: 0,
      },
      monthlyFinancials: [],
      paymentStatusDistribution: [],
      occupancyByPG: [],
      roomSharingDistribution: [],
      enquiryFunnel: [],
      tenantMovements: [],
      genderDistribution: [],
      expenseCategories: [],
      pgLeaderboard: [],
      properties: [],
    };
  }

  // If specific pgId is passed, verify access
  let activePgs = userPgs;
  if (pgId) {
    const matched = userPgs.find((p) => String(p._id) === String(pgId));
    if (!matched) {
      throw new ApiError(httpStatus.FORBIDDEN, "Access denied: You do not own or manage this property");
    }
    activePgs = [matched];
  }

  const targetPgIds = activePgs.map((p) => p._id);
  const monthList = generateMonthRange(Number(months));

  // ── Parallel Aggregations ──────────────────────────────────────────────────
  const [
    rentRecords,
    expenseRecords,
    staffPaymentRecords,
    roomRecords,
    enquiries,
    bedAssignments,
    occupiedBedsWithUsers,
  ] = await Promise.all([
    // 1. Rent payments in target month list
    RentPayment.find({
      pgId: { $in: targetPgIds },
      rentMonth: { $in: monthList },
      isDeleted: false,
    }),

    // 2. Approved operating expenses
    Expense.find({
      pgId: { $in: targetPgIds },
      status: "approved",
      isDeleted: false,
    }),

    // 3. Staff payroll records in target month list
    StaffPayment.find({
      pgId: { $in: targetPgIds },
      month: { $in: monthList },
      isDeleted: false,
    }),

    // 4. Rooms for sharing type breakdown
    Room.find({
      pgId: { $in: targetPgIds },
      isDeleted: false,
    }),

    // 5. Enquiries
    Enquiry.find({
      pgId: { $in: targetPgIds },
      isDeleted: false,
    }),

    // 6. Bed Assignments for movements (check-ins & check-outs)
    BedAssignment.find({
      pgId: { $in: targetPgIds },
      isDeleted: false,
    }),

    // 7. Currently occupied beds with tenant details for demographics
    Bed.find({
      pgId: { $in: targetPgIds },
      status: "occupied",
      isDeleted: false,
    }).populate("userId", "gender"),
  ]);

  // ── A. Financial Analytics (Month-by-Month Trend) ──────────────────────────
  const financialByMonth = new Map();
  monthList.forEach((m) => {
    financialByMonth.set(m, {
      month: m,
      monthLabel: toMonthLabel(m),
      rentBilled: 0,
      rentCollected: 0,
      expenses: 0,
      payroll: 0,
      totalExpenses: 0,
      netProfit: 0,
    });
  });

  // Aggregate Rent
  const statusCounts = { paid: 0, pending: 0, overdue: 0, partial: 0, under_review: 0 };
  const statusAmounts = { paid: 0, pending: 0, overdue: 0, partial: 0, under_review: 0 };
  let grandTotalBilled = 0;
  let grandTotalCollected = 0;

  rentRecords.forEach((r) => {
    const due = (r.amount || 0) + (r.penaltyAmount || 0);
    const paid = r.amountPaid || 0;
    grandTotalBilled += due;
    grandTotalCollected += paid;

    if (financialByMonth.has(r.rentMonth)) {
      const entry = financialByMonth.get(r.rentMonth);
      entry.rentBilled += due;
      entry.rentCollected += paid;
    }

    const st = r.status || "pending";
    if (statusCounts[st] !== undefined) {
      statusCounts[st] += 1;
      statusAmounts[st] += due;
    }
  });

  // Aggregate Expenses
  let grandTotalExpenses = 0;
  const categoryTotals = new Map();

  expenseRecords.forEach((exp) => {
    const expMonth = toMonthKey(exp.spentDate);
    const amt = exp.amount || 0;

    const cat = exp.category || "General";
    categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + amt);

    if (financialByMonth.has(expMonth)) {
      const entry = financialByMonth.get(expMonth);
      entry.expenses += amt;
      entry.totalExpenses += amt;
      grandTotalExpenses += amt;
    }
  });

  // Aggregate Staff Payments (Payroll)
  staffPaymentRecords.forEach((sp) => {
    const amt = sp.totalAmount || sp.salaryAmount || 0;
    if (financialByMonth.has(sp.month)) {
      const entry = financialByMonth.get(sp.month);
      entry.payroll += amt;
      entry.totalExpenses += amt;
      grandTotalExpenses += amt;
    }
  });

  // Compute Net Profit for each month
  const monthlyFinancials = Array.from(financialByMonth.values()).map((item) => ({
    ...item,
    netProfit: item.rentCollected - item.totalExpenses,
  }));

  const grandNetProfit = grandTotalCollected - grandTotalExpenses;
  const collectionRate = grandTotalBilled > 0
    ? Math.round((grandTotalCollected / grandTotalBilled) * 100)
    : 0;

  // ── B. Payment Status Distribution (Donut Chart) ──────────────────────────
  const paymentStatusConfig = [
    { key: "paid", label: "Paid", color: "#51cf66" },
    { key: "partial", label: "Partial", color: "#6c63ff" },
    { key: "pending", label: "Pending", color: "#ffa94d" },
    { key: "overdue", label: "Overdue", color: "#ff4d6d" },
    { key: "under_review", label: "Under Review", color: "#00d4aa" },
  ];

  const paymentStatusDistribution = paymentStatusConfig.map((cfg) => ({
    status: cfg.key,
    label: cfg.label,
    count: statusCounts[cfg.key] || 0,
    amount: statusAmounts[cfg.key] || 0,
    color: cfg.color,
  }));

  // ── C. Expense Category Breakdown ─────────────────────────────────────────
  const expenseCategories = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  // ── D. Occupancy & Capacity Analytics ─────────────────────────────────────
  let totalCapacity = 0;
  let totalOccupied = 0;
  let totalEmpty = 0;

  const occupancyByPG = activePgs.map((pg) => {
    const cap = pg.totalBeds || 0;
    const occ = pg.occupiedBeds || 0;
    const emp = pg.emptyBeds || 0;
    totalCapacity += cap;
    totalOccupied += occ;
    totalEmpty += emp;

    const rate = cap > 0 ? Math.round((occ / cap) * 100) : 0;
    return {
      pgId: pg._id,
      pgName: pg.name,
      pgType: pg.pgType,
      totalBeds: cap,
      occupiedBeds: occ,
      emptyBeds: emp,
      occupancyRate: rate,
    };
  });

  const overallOccupancyRate = totalCapacity > 0
    ? Math.round((totalOccupied / totalCapacity) * 100)
    : 0;

  // ── E. Room Sharing Distribution (Pie / Donut Chart) ───────────────────────
  const sharingMap = { 1: 0, 2: 0, 3: 0, "4+": 0 };
  roomRecords.forEach((rm) => {
    const share = rm.sharingType;
    if (share === 1) sharingMap[1] += 1;
    else if (share === 2) sharingMap[2] += 1;
    else if (share === 3) sharingMap[3] += 1;
    else if (share >= 4) sharingMap["4+"] += 1;
  });

  const roomSharingDistribution = [
    { label: "Single Sharing", key: "1", count: sharingMap[1], color: "#6c63ff" },
    { label: "Double Sharing", key: "2", count: sharingMap[2], color: "#00d4aa" },
    { label: "Triple Sharing", key: "3", count: sharingMap[3], color: "#ffa94d" },
    { label: "4+ Sharing", key: "4+", count: sharingMap["4+"], color: "#a855f7" },
  ];

  // ── F. Enquiry Conversion Funnel ──────────────────────────────────────────
  const funnelCounts = {
    interested: 0,
    contacted: 0,
    visited: 0,
    dealDone: 0,
    rejected: 0,
    inventoryFull: 0,
  };

  enquiries.forEach((enq) => {
    const s = enq.status || "interested";
    if (funnelCounts[s] !== undefined) {
      funnelCounts[s] += 1;
    }
  });

  const totalLeads = enquiries.length;
  const dealDoneCount = funnelCounts.dealDone || 0;
  const conversionRate = totalLeads > 0 ? Math.round((dealDoneCount / totalLeads) * 100) : 0;

  const enquiryFunnel = [
    { stage: "Interested", key: "interested", count: funnelCounts.interested, color: "#6c63ff" },
    { stage: "Contacted", key: "contacted", count: funnelCounts.contacted, color: "#ffa94d" },
    { stage: "Visited", key: "visited", count: funnelCounts.visited, color: "#a855f7" },
    { stage: "Deal Done", key: "dealDone", count: funnelCounts.dealDone, color: "#51cf66" },
    { stage: "Lost / Rejected", key: "rejected", count: funnelCounts.rejected + funnelCounts.inventoryFull, color: "#ff4d6d" },
  ];

  // ── G. Tenant Dynamics & Demographics ─────────────────────────────────────
  const movementByMonth = new Map();
  monthList.forEach((m) => {
    movementByMonth.set(m, { month: m, monthLabel: toMonthLabel(m), checkIns: 0, checkOuts: 0 });
  });

  bedAssignments.forEach((ba) => {
    if (ba.startDate) {
      const inMonth = toMonthKey(ba.startDate);
      if (movementByMonth.has(inMonth)) {
        movementByMonth.get(inMonth).checkIns += 1;
      }
    }
    if (ba.endDate) {
      const outMonth = toMonthKey(ba.endDate);
      if (movementByMonth.has(outMonth)) {
        movementByMonth.get(outMonth).checkOuts += 1;
      }
    }
  });

  const tenantMovements = Array.from(movementByMonth.values());

  // Gender Distribution among active tenants
  const genderCounts = { male: 0, female: 0, other: 0 };
  occupiedBedsWithUsers.forEach((b) => {
    const g = b.userId?.gender?.toLowerCase();
    if (g === "male") genderCounts.male += 1;
    else if (g === "female") genderCounts.female += 1;
    else genderCounts.other += 1;
  });

  const genderDistribution = [
    { label: "Male Residents", key: "male", count: genderCounts.male, color: "#3b82f6" },
    { label: "Female Residents", key: "female", count: genderCounts.female, color: "#ec4899" },
    { label: "Other / Unspecified", key: "other", count: genderCounts.other, color: "#8b5cf6" },
  ];

  // ── H. PG Performance Leaderboard ─────────────────────────────────────────
  const pgRevenueMap = new Map();
  rentRecords.forEach((r) => {
    const id = String(r.pgId);
    pgRevenueMap.set(id, (pgRevenueMap.get(id) || 0) + (r.amountPaid || 0));
  });

  const pgExpenseMap = new Map();
  expenseRecords.forEach((e) => {
    const id = String(e.pgId);
    pgExpenseMap.set(id, (pgExpenseMap.get(id) || 0) + (e.amount || 0));
  });
  staffPaymentRecords.forEach((sp) => {
    const id = String(sp.pgId);
    pgExpenseMap.set(id, (pgExpenseMap.get(id) || 0) + (sp.totalAmount || sp.salaryAmount || 0));
  });

  const pgLeaderboard = activePgs.map((pg) => {
    const id = String(pg._id);
    const rev = pgRevenueMap.get(id) || 0;
    const exp = pgExpenseMap.get(id) || 0;
    const cap = pg.totalBeds || 0;
    const occ = pg.occupiedBeds || 0;
    const occRate = cap > 0 ? Math.round((occ / cap) * 100) : 0;

    return {
      _id: pg._id,
      name: pg.name,
      pgType: pg.pgType,
      city: pg.address?.city || "",
      state: pg.address?.state || "",
      totalRooms: pg.totalRooms || 0,
      totalBeds: cap,
      occupiedBeds: occ,
      emptyBeds: pg.emptyBeds || 0,
      occupancyRate: occRate,
      rating: pg.rating || 0,
      numReviews: pg.numReviews || 0,
      revenue: rev,
      expenses: exp,
      netProfit: rev - exp,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  return {
    summary: {
      totalRevenue: grandTotalCollected,
      totalBilled: grandTotalBilled,
      totalExpenses: grandTotalExpenses,
      netProfit: grandNetProfit,
      collectionRate,
      totalCapacity,
      totalOccupied,
      totalEmpty,
      overallOccupancyRate,
      totalLeads,
      conversionRate,
      activeTenantsCount: occupiedBedsWithUsers.length,
    },
    monthlyFinancials,
    paymentStatusDistribution,
    expenseCategories,
    occupancyByPG,
    roomSharingDistribution,
    enquiryFunnel,
    tenantMovements,
    genderDistribution,
    pgLeaderboard,
    properties: userPgs.map((p) => ({ _id: p._id, name: p.name, pgType: p.pgType })),
  };
};

module.exports = {
  getOverviewAnalytics,
};
