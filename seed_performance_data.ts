/* Run with: npx tsx seed-performance-data.ts */
import { PrismaClient } from "./generated/prisma";
const prisma = new PrismaClient();

async function seedPerformanceData() {
  try {
    console.log("🌱 Seeding performance data...");

    // Seed Workers if none exist
    let workers = await prisma.worker.findMany({
      where: { isDeleted: false },
    });

    if (workers.length === 0) {
      console.log("👷 Creating workers...");
      const workerData = [
        { name: "Ahmed Ben Ali", cin: "12345678", phone: "+21612345001", email: "ahmed.benali@factory.tn", role: "Operator" },
        { name: "Fatma Trabelsi", cin: "23456789", phone: "+21612345002", email: "fatma.trabelsi@factory.tn", role: "Supervisor" },
        { name: "Mohamed Jaziri", cin: "34567890", phone: "+21612345003", email: "mohamed.jaziri@factory.tn", role: "Technician" },
        { name: "Salma Karoui", cin: "45678901", phone: "+21612345004", email: "salma.karoui@factory.tn", role: "Operator" },
        { name: "Youssef Gharbi", cin: "56789012", phone: "+21612345005", email: "youssef.gharbi@factory.tn", role: "Quality Checker" },
        { name: "Nadia Hamdi", cin: "67890123", phone: "+21612345006", email: "nadia.hamdi@factory.tn", role: "Operator" },
        { name: "Karim Sassi", cin: "78901234", phone: "+21612345007", email: "karim.sassi@factory.tn", role: "Technician" },
        { name: "Leila Mejri", cin: "89012345", phone: "+21612345008", email: "leila.mejri@factory.tn", role: "Supervisor" },
        { name: "Rami Bouazizi", cin: "90123456", phone: "+21612345009", email: "rami.bouazizi@factory.tn", role: "Operator" },
        { name: "Sonia Chaieb", cin: "01234567", phone: "+21612345010", email: "sonia.chaieb@factory.tn", role: "Operator" },
        { name: "Hichem Dridi", cin: "11234568", phone: "+21612345011", email: "hichem.dridi@factory.tn", role: "Quality Checker" },
        { name: "Amira Ghanmi", cin: "22345679", phone: "+21612345012", email: "amira.ghanmi@factory.tn", role: "Operator" },
        { name: "Bilel Khalfallah", cin: "33456780", phone: "+21612345013", email: "bilel.khalfallah@factory.tn", role: "Technician" },
        { name: "Mariem Toumi", cin: "44567891", phone: "+21612345014", email: "mariem.toumi@factory.tn", role: "Operator" },
        { name: "Sofien Mansouri", cin: "55678902", phone: "+21612345015", email: "sofien.mansouri@factory.tn", role: "Supervisor" },
      ];

      await prisma.worker.createMany({ data: workerData });
      workers = await prisma.worker.findMany({ where: { isDeleted: false } });
      console.log(`   ✅ Created ${workers.length} workers`);
    }

    // Seed Products if none exist
    let products = await prisma.product.findMany({
      where: { isDeleted: false },
    });

    if (products.length === 0) {
      console.log("📦 Creating products...");
      const productData = [
        { 
          name: "Standard Widget A", 
          code: "WGT-A-001", 
          description: "High-quality standard widget for general manufacturing",
          category: "Widgets",
          unitPrice: 15.50
        },
        { 
          name: "Premium Component B", 
          code: "CMP-B-002", 
          description: "Premium grade component with enhanced durability",
          category: "Components",
          unitPrice: 28.75
        },
        { 
          name: "Industrial Part C", 
          code: "PRT-C-003", 
          description: "Heavy-duty industrial part for machinery",
          category: "Parts",
          unitPrice: 42.00
        },
      ];

      await prisma.product.createMany({ data: productData });
      products = await prisma.product.findMany({ where: { isDeleted: false } });
      console.log(`   ✅ Created ${products.length} products`);
    }

    // Seed Production Lines if none exist
    let productionLines = await prisma.productionLine.findMany({
      where: { isDeleted: false },
    });

    if (productionLines.length === 0) {
      console.log("🏭 Creating production lines...");
      const productionLineData = [
        { 
          name: "Assembly Line Alpha", 
          description: "Main assembly line for widget production",
          capacity: 500,
          targetOutput: 450,
          location: "Building A - Floor 1"
        },
        { 
          name: "Assembly Line Beta", 
          description: "Secondary assembly line for component manufacturing",
          capacity: 400,
          targetOutput: 350,
          location: "Building A - Floor 2"
        },
        { 
          name: "Processing Line Gamma", 
          description: "Specialized processing line for industrial parts",
          capacity: 300,
          targetOutput: 280,
          location: "Building B - Floor 1"
        },
        { 
          name: "Quality Control Line", 
          description: "Dedicated line for quality inspection and testing",
          capacity: 200,
          targetOutput: 180,
          location: "Building C - Floor 1"
        },
      ];

      await prisma.productionLine.createMany({ data: productionLineData });
      productionLines = await prisma.productionLine.findMany({ where: { isDeleted: false } });
      console.log(`   ✅ Created ${productionLines.length} production lines`);
    }

    // Clear existing performance data
    await prisma.performanceRecord.deleteMany();
    await prisma.assignment.deleteMany();
    console.log("🗑️  Cleared existing performance records and assignments");

    const shifts = ["morning", "afternoon", "night"] as const;
    const positions = ["Operator", "Supervisor", "Technician", "Quality Checker"];

    const performanceRecords = [];
    const assignments = [];

    // Helper function to generate a random date between start and end
    const getRandomDate = (start: Date, end: Date): Date => {
      const startTime = start.getTime();
      const endTime = end.getTime();
      const randomTime = startTime + Math.random() * (endTime - startTime);
      return new Date(randomTime);
    };

    // CRITICAL FIX: Use UTC dates consistently
    const now = new Date();
    
    // Create "today" at midnight UTC
    const today = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ));
    
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    // Track assignments to ensure performance records match
    const assignmentMap = new Map<string, any>();

    // Generate assignments first (spread across 31 days: -30 to +1)
    const numAssignmentsPerDay = 5;
    const totalDays = 32; // 30 days ago + today + tomorrow
    const totalAssignments = numAssignmentsPerDay * totalDays;

    console.log(`📅 Generating data from ${thirtyDaysAgo.toISOString()} to ${tomorrow.toISOString()}`);
    console.log(`🌍 Using UTC timezone for consistency`);

    for (let i = 0; i < totalAssignments; i++) {
      const worker = workers[Math.floor(Math.random() * workers.length)];
      const productionLine = productionLines[Math.floor(Math.random() * productionLines.length)];
      const shift = shifts[Math.floor(Math.random() * shifts.length)];
      const position = positions[Math.floor(Math.random() * positions.length)];

      // Random date between 30 days ago and tomorrow
      const randomDate = getRandomDate(thirtyDaysAgo, tomorrow);
      
      // Normalize to midnight UTC
      const date = new Date(Date.UTC(
        randomDate.getUTCFullYear(),
        randomDate.getUTCMonth(),
        randomDate.getUTCDate(),
        0, 0, 0, 0
      ));

      const assignment = {
        workerId: worker.id,
        productionLineId: productionLine.id,
        position,
        shift,
        date,
      };

      assignments.push(assignment);

      // Store assignment for creating matching performance records
      const key = `${worker.id}-${productionLine.id}-${shift}-${date.toISOString()}`;
      assignmentMap.set(key, assignment);
    }

    // Generate performance records matching assignments
    // Only create performance records for past dates and today (not tomorrow)
    for (const [key, assignment] of assignmentMap.entries()) {
      const assignmentDate = new Date(assignment.date);
      
      // Skip future dates (tomorrow) for performance records
      if (assignmentDate > today) {
        continue;
      }

      // 70% chance to have performance record for each assignment
      if (Math.random() > 0.7) {
        continue;
      }

      const product = products[Math.floor(Math.random() * products.length)];

      // Generate realistic performance metrics
      const baseProduction = 100;
      const variance = 50;
      const piecesMade = Math.floor(baseProduction + Math.random() * variance);
      
      // Time taken based on shift (8-10 hours)
      const timeTaken = 8 + Math.random() * 2;
      
      // Error rate: typically low (0-3%), occasionally higher
      const errorRate = Math.random() < 0.8 
        ? Math.random() * 3 
        : 3 + Math.random() * 5;

      performanceRecords.push({
        workerId: assignment.workerId,
        productId: product.id,
        productionLineId: assignment.productionLineId,
        date: assignment.date,
        piecesMade,
        shift: assignment.shift,
        timeTaken: parseFloat(timeTaken.toFixed(2)),
        errorRate: parseFloat(errorRate.toFixed(2)),
      });
    }

    // Insert both datasets
    await prisma.assignment.createMany({ data: assignments });
    await prisma.performanceRecord.createMany({ data: performanceRecords });

    // Calculate statistics
    const todayAssignments = assignments.filter(
      a => a.date.toISOString().split('T')[0] === today.toISOString().split('T')[0]
    ).length;
    
    const tomorrowAssignments = assignments.filter(
      a => a.date.toISOString().split('T')[0] === tomorrow.toISOString().split('T')[0]
    ).length;
    
    const todayRecords = performanceRecords.filter(
      r => r.date.toISOString().split('T')[0] === today.toISOString().split('T')[0]
    ).length;

    console.log(`\n✅ Successfully seeded data:`);
    console.log(`   👷 ${workers.length} workers`);
    console.log(`   📦 ${products.length} products`);
    console.log(`   🏭 ${productionLines.length} production lines`);
    console.log(`   📋 ${assignments.length} total assignments`);
    console.log(`   📊 ${performanceRecords.length} total performance records`);
    console.log(`\n📅 Distribution:`);
    console.log(`   Today (${today.toISOString().split('T')[0]}): ${todayAssignments} assignments, ${todayRecords} records`);
    console.log(`   Tomorrow (${tomorrow.toISOString().split('T')[0]}): ${tomorrowAssignments} assignments, 0 records (future)`);
    console.log(`   Last 30 days: ${assignments.length - todayAssignments - tomorrowAssignments} assignments`);
    console.log(`\n🎯 Coverage: ${((performanceRecords.length / (assignments.length - tomorrowAssignments)) * 100).toFixed(1)}% of past assignments have performance records`);

  } catch (error) {
    console.error("❌ Error seeding data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedPerformanceData();