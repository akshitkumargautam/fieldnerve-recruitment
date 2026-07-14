import { mandatoryDocsConfig } from './mandatoryDocs.config';

export function evaluateEligibility(vendor: any, requirement: any) {
  if (vendor.category.trim().toLowerCase() !== requirement.category.trim().toLowerCase()) {
    return { eligible: false, reason: `Category mismatch: vendor is ${vendor.category}, requirement needs ${requirement.category}` };
  }

  if (vendor.currentStatus !== 'ACTIVE') {
    return { eligible: false, reason: `Vendor status is ${vendor.currentStatus}, not ACTIVE` };
  }

  const mandatoryDocs = new Set(mandatoryDocsConfig[vendor.category]);
  if (requirement.priority === 'CRITICAL') {
    mandatoryDocs.add('SAFETY_CERTIFICATE');
  }

  const missingOrExpired: string[] = [];
  
  for (const docType of mandatoryDocs) {
    const doc = vendor.documents.find((d: any) => d.documentType === docType);
    if (!doc) {
      missingOrExpired.push(`Missing required document: ${docType}`);
    } else if (doc.status === 'EXPIRED') {
      missingOrExpired.push(`${docType} is expired`);
    }
  }

  if (missingOrExpired.length > 0) {
    return { eligible: false, reason: missingOrExpired.join('; ') };
  }

  return { eligible: true, reason: null };
}
