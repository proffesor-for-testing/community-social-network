// Entities
export { ConsentEntity, ConsentType } from './consent.entity';

// Services
export { DataExportService } from './data-export.service';
export type { ExportRequest } from './data-export.service';
export { DataErasureService } from './data-erasure.service';
export type { ErasureResult } from './data-erasure.service';
export { ConsentService } from './consent.service';
export type { ConsentRecord, UpdateConsentDto } from './consent.service';

// Module
export { GdprModule } from './gdpr.module';
