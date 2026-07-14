import { PrismaClient } from '@prisma/client';

const VendorType = { CONTRACTOR: 'CONTRACTOR', SUBCONTRACTOR: 'SUBCONTRACTOR', EQUIPMENT_RENTAL: 'EQUIPMENT_RENTAL', MATERIAL_SUPPLIER: 'MATERIAL_SUPPLIER', INSPECTION_AGENCY: 'INSPECTION_AGENCY', CONSULTANT: 'CONSULTANT' };
const Category = { CIVIL_CONSTRUCTION: 'CIVIL_CONSTRUCTION', ELECTRICAL_INSTRUMENTATION: 'ELECTRICAL_INSTRUMENTATION', MECHANICAL_FABRICATION: 'MECHANICAL_FABRICATION', LOGISTICS_EQUIPMENT: 'LOGISTICS_EQUIPMENT', HSE_COMPLIANCE_TESTING: 'HSE_COMPLIANCE_TESTING' };
const VendorStatus = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', SUSPENDED: 'SUSPENDED', BLACKLISTED: 'BLACKLISTED' };
const DocumentType = { TAX_REGISTRATION: 'TAX_REGISTRATION', INSURANCE: 'INSURANCE', TRADE_LICENSE: 'TRADE_LICENSE', SAFETY_CERTIFICATE: 'SAFETY_CERTIFICATE', AGREEMENT: 'AGREEMENT' };
const DocumentStatus = { VALID: 'VALID', EXPIRED: 'EXPIRED', PENDING_VERIFICATION: 'PENDING_VERIFICATION' };
const Priority = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' };
const RequirementStatus = { OPEN: 'OPEN', ASSIGNED: 'ASSIGNED', CLOSED: 'CLOSED' };

const prisma = new PrismaClient();

async function main() {
  // Clear existing
  await prisma.recommendationResult.deleteMany();
  await prisma.recommendationRun.deleteMany();
  await prisma.workRequirement.deleteMany();
  await prisma.vendorDocument.deleteMany();
  await prisma.vendor.deleteMany();

  const today = new Date();
  const plus30Days = new Date(today);
  plus30Days.setDate(today.getDate() + 30);
  const plus20Days = new Date(today);
  plus20Days.setDate(today.getDate() + 20);
  const plus3Days = new Date(today);
  plus3Days.setDate(today.getDate() + 3);
  const plus14Days = new Date(today);
  plus14Days.setDate(today.getDate() + 14);
  const plus7Days = new Date(today);
  plus7Days.setDate(today.getDate() + 7);
  const minus10Days = new Date(today);
  minus10Days.setDate(today.getDate() - 10);

  // VENDOR 1: Apex Civil Works
  const v1 = await prisma.vendor.create({
    data: {
      name: 'Apex Civil Works',
      vendorType: VendorType.CONTRACTOR,
      category: Category.CIVIL_CONSTRUCTION,
      contactPerson: 'Contact 1',
      phone: '12345',
      email: 'v1@test.com',
      operatingLocation: 'Maharashtra',
      rating: 4.5,
      safetyRating: 4.0,
      currentStatus: VendorStatus.ACTIVE,
      documents: {
        create: [
          { documentType: DocumentType.TAX_REGISTRATION, documentNumber: 'DOC1', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.INSURANCE, documentNumber: 'DOC2', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.TRADE_LICENSE, documentNumber: 'DOC3', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.SAFETY_CERTIFICATE, documentNumber: 'DOC4', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.AGREEMENT, documentNumber: 'DOC5', status: DocumentStatus.VALID, expiryDate: plus30Days },
        ]
      }
    }
  });

  // VENDOR 2: Bharat Infra Builders
  const v2 = await prisma.vendor.create({
    data: {
      name: 'Bharat Infra Builders',
      vendorType: VendorType.CONTRACTOR,
      category: Category.CIVIL_CONSTRUCTION,
      contactPerson: 'Contact 2',
      phone: '12345',
      email: 'v2@test.com',
      operatingLocation: 'Maharashtra',
      rating: 4.0,
      safetyRating: 3.5,
      currentStatus: VendorStatus.ACTIVE,
      documents: {
        create: [
          { documentType: DocumentType.TAX_REGISTRATION, documentNumber: 'DOC1', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.INSURANCE, documentNumber: 'DOC2', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.TRADE_LICENSE, documentNumber: 'DOC3', status: DocumentStatus.EXPIRED, expiryDate: minus10Days },
          { documentType: DocumentType.SAFETY_CERTIFICATE, documentNumber: 'DOC4', status: DocumentStatus.VALID, expiryDate: plus30Days },
        ]
      }
    }
  });

  // VENDOR 3: Deccan Structures
  const v3 = await prisma.vendor.create({
    data: {
      name: 'Deccan Structures',
      vendorType: VendorType.SUBCONTRACTOR,
      category: Category.CIVIL_CONSTRUCTION,
      contactPerson: 'Contact 3',
      phone: '12345',
      email: 'v3@test.com',
      operatingLocation: 'Gujarat',
      rating: 4.8,
      safetyRating: 4.9,
      currentStatus: VendorStatus.ACTIVE,
      documents: {
        create: [
          { documentType: DocumentType.TAX_REGISTRATION, documentNumber: 'DOC1', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.INSURANCE, documentNumber: 'DOC2', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.TRADE_LICENSE, documentNumber: 'DOC3', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.SAFETY_CERTIFICATE, documentNumber: 'DOC4', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.AGREEMENT, documentNumber: 'DOC5', status: DocumentStatus.VALID, expiryDate: plus30Days },
        ]
      }
    }
  });

  // VENDOR 4: VoltLine Electricals
  const v4 = await prisma.vendor.create({
    data: {
      name: 'VoltLine Electricals',
      vendorType: VendorType.CONTRACTOR,
      category: Category.ELECTRICAL_INSTRUMENTATION,
      contactPerson: 'Contact 4',
      phone: '12345',
      email: 'v4@test.com',
      operatingLocation: 'Maharashtra',
      rating: 4.2,
      safetyRating: 4.5,
      currentStatus: VendorStatus.ACTIVE,
      documents: {
        create: [
          { documentType: DocumentType.TAX_REGISTRATION, documentNumber: 'DOC1', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.INSURANCE, documentNumber: 'DOC2', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.TRADE_LICENSE, documentNumber: 'DOC3', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.SAFETY_CERTIFICATE, documentNumber: 'DOC4', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.AGREEMENT, documentNumber: 'DOC5', status: DocumentStatus.VALID, expiryDate: plus30Days },
        ]
      }
    }
  });

  // VENDOR 5: PowerGrid Systems
  const v5 = await prisma.vendor.create({
    data: {
      name: 'PowerGrid Systems',
      vendorType: VendorType.SUBCONTRACTOR,
      category: Category.ELECTRICAL_INSTRUMENTATION,
      contactPerson: 'Contact 5',
      phone: '12345',
      email: 'v5@test.com',
      operatingLocation: 'Maharashtra',
      rating: 3.8,
      safetyRating: 3.0,
      currentStatus: VendorStatus.ACTIVE,
      documents: {
        create: [
          { documentType: DocumentType.TAX_REGISTRATION, documentNumber: 'DOC1', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.INSURANCE, documentNumber: 'DOC2', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.TRADE_LICENSE, documentNumber: 'DOC3', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.SAFETY_CERTIFICATE, documentNumber: 'DOC4', status: DocumentStatus.VALID, expiryDate: plus20Days }, // expires soon
          { documentType: DocumentType.AGREEMENT, documentNumber: 'DOC5', status: DocumentStatus.VALID, expiryDate: plus30Days },
        ]
      }
    }
  });

  // VENDOR 6: IronForge Fabricators
  const v6 = await prisma.vendor.create({
    data: {
      name: 'IronForge Fabricators',
      vendorType: VendorType.CONTRACTOR,
      category: Category.MECHANICAL_FABRICATION,
      contactPerson: 'Contact 6',
      phone: '12345',
      email: 'v6@test.com',
      operatingLocation: 'Rajasthan',
      rating: 4.0,
      safetyRating: 4.0,
      currentStatus: VendorStatus.ACTIVE,
      documents: {
        create: [
          { documentType: DocumentType.TAX_REGISTRATION, documentNumber: 'DOC1', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.INSURANCE, documentNumber: 'DOC2', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.TRADE_LICENSE, documentNumber: 'DOC3', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.SAFETY_CERTIFICATE, documentNumber: 'DOC4', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.AGREEMENT, documentNumber: 'DOC5', status: DocumentStatus.VALID, expiryDate: plus30Days },
        ]
      }
    }
  });

  // VENDOR 7: Precision Metal Works
  const v7 = await prisma.vendor.create({
    data: {
      name: 'Precision Metal Works',
      vendorType: VendorType.SUBCONTRACTOR,
      category: Category.MECHANICAL_FABRICATION,
      contactPerson: 'Contact 7',
      phone: '12345',
      email: 'v7@test.com',
      operatingLocation: 'Rajasthan',
      rating: 3.5,
      safetyRating: 3.5,
      currentStatus: VendorStatus.SUSPENDED,
      documents: {
        create: [
          { documentType: DocumentType.TAX_REGISTRATION, documentNumber: 'DOC1', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.INSURANCE, documentNumber: 'DOC2', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.TRADE_LICENSE, documentNumber: 'DOC3', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.SAFETY_CERTIFICATE, documentNumber: 'DOC4', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.AGREEMENT, documentNumber: 'DOC5', status: DocumentStatus.VALID, expiryDate: plus30Days },
        ]
      }
    }
  });

  // VENDOR 8: Swift Logistics
  const v8 = await prisma.vendor.create({
    data: {
      name: 'Swift Logistics',
      vendorType: VendorType.EQUIPMENT_RENTAL,
      category: Category.LOGISTICS_EQUIPMENT,
      contactPerson: 'Contact 8',
      phone: '12345',
      email: 'v8@test.com',
      operatingLocation: 'Maharashtra',
      rating: 4.1,
      safetyRating: 3.8,
      currentStatus: VendorStatus.ACTIVE,
      documents: {
        create: [
          { documentType: DocumentType.TAX_REGISTRATION, documentNumber: 'DOC1', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.INSURANCE, documentNumber: 'DOC2', status: DocumentStatus.VALID, expiryDate: plus30Days },
        ]
      }
    }
  });

  // VENDOR 9: HeavyHaul Equipment Co
  const v9 = await prisma.vendor.create({
    data: {
      name: 'HeavyHaul Equipment Co',
      vendorType: VendorType.EQUIPMENT_RENTAL,
      category: Category.LOGISTICS_EQUIPMENT,
      contactPerson: 'Contact 9',
      phone: '12345',
      email: 'v9@test.com',
      operatingLocation: 'Maharashtra',
      rating: 3.9,
      safetyRating: 3.6,
      currentStatus: VendorStatus.ACTIVE,
      documents: {
        create: [
          { documentType: DocumentType.TAX_REGISTRATION, documentNumber: 'DOC1', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.INSURANCE, documentNumber: 'DOC2', status: DocumentStatus.EXPIRED, expiryDate: minus10Days },
        ]
      }
    }
  });

  // VENDOR 10: SafetyFirst Inspections
  const v10 = await prisma.vendor.create({
    data: {
      name: 'SafetyFirst Inspections',
      vendorType: VendorType.INSPECTION_AGENCY,
      category: Category.HSE_COMPLIANCE_TESTING,
      contactPerson: 'Contact 10',
      phone: '12345',
      email: 'v10@test.com',
      operatingLocation: 'Maharashtra',
      rating: 4.7,
      safetyRating: 5.0,
      currentStatus: VendorStatus.ACTIVE,
      documents: {
        create: [
          { documentType: DocumentType.TAX_REGISTRATION, documentNumber: 'DOC1', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.INSURANCE, documentNumber: 'DOC2', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.TRADE_LICENSE, documentNumber: 'DOC3', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.SAFETY_CERTIFICATE, documentNumber: 'DOC4', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.AGREEMENT, documentNumber: 'DOC5', status: DocumentStatus.VALID, expiryDate: plus30Days },
        ]
      }
    }
  });

  // VENDOR 11: ComplyCheck Consultants
  const v11 = await prisma.vendor.create({
    data: {
      name: 'ComplyCheck Consultants',
      vendorType: VendorType.CONSULTANT,
      category: Category.HSE_COMPLIANCE_TESTING,
      contactPerson: 'Contact 11',
      phone: '12345',
      email: 'v11@test.com',
      operatingLocation: 'Maharashtra',
      rating: 3.2,
      safetyRating: 3.0,
      currentStatus: VendorStatus.ACTIVE,
      documents: {
        create: [
          { documentType: DocumentType.INSURANCE, documentNumber: 'DOC2', status: DocumentStatus.VALID, expiryDate: plus30Days },
        ]
      }
    }
  });

  // VENDOR 12: Blacklisted Builders
  const v12 = await prisma.vendor.create({
    data: {
      name: 'Blacklisted Builders',
      vendorType: VendorType.CONTRACTOR,
      category: Category.CIVIL_CONSTRUCTION,
      contactPerson: 'Contact 12',
      phone: '12345',
      email: 'v12@test.com',
      operatingLocation: 'Maharashtra',
      rating: 4.9,
      safetyRating: 4.9,
      currentStatus: VendorStatus.BLACKLISTED,
      documents: {
        create: [
          { documentType: DocumentType.TAX_REGISTRATION, documentNumber: 'DOC1', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.INSURANCE, documentNumber: 'DOC2', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.TRADE_LICENSE, documentNumber: 'DOC3', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.SAFETY_CERTIFICATE, documentNumber: 'DOC4', status: DocumentStatus.VALID, expiryDate: plus30Days },
          { documentType: DocumentType.AGREEMENT, documentNumber: 'DOC5', status: DocumentStatus.VALID, expiryDate: plus30Days },
        ]
      }
    }
  });

  // WORK REQUIREMENTS
  const wrA = await prisma.workRequirement.create({
    data: {
      title: 'Highway Bridge Retrofit',
      category: Category.CIVIL_CONSTRUCTION,
      location: 'Maharashtra',
      estimatedValue: 5000000,
      priority: Priority.MEDIUM,
      expectedStartDate: plus30Days,
    }
  });

  const wrB = await prisma.workRequirement.create({
    data: {
      title: 'Emergency Bridge Repair',
      category: Category.CIVIL_CONSTRUCTION,
      location: 'Maharashtra',
      estimatedValue: 5000000,
      priority: Priority.CRITICAL,
      expectedStartDate: plus3Days,
    }
  });

  const wrC = await prisma.workRequirement.create({
    data: {
      title: 'Substation Automation Upgrade',
      category: Category.ELECTRICAL_INSTRUMENTATION,
      location: 'Maharashtra',
      estimatedValue: 2000000,
      priority: Priority.HIGH,
      expectedStartDate: plus14Days,
    }
  });

  const wrD = await prisma.workRequirement.create({
    data: {
      title: 'Site HSE Compliance Audit',
      category: Category.HSE_COMPLIANCE_TESTING,
      location: 'Maharashtra',
      estimatedValue: 500000,
      priority: Priority.LOW,
      expectedStartDate: plus7Days,
    }
  });

  console.log("Seeding finished.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
