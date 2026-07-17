import 'dotenv/config';
import express from 'express';
import { errorHandler } from './shared/errors';
import { vendorRoutes } from './modules/vendors/vendor.routes';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

import { vendorDocumentRoutes } from './modules/vendor-documents/document.routes';
import { workRequirementRoutes } from './modules/work-requirements/workRequirement.routes';
import { recommendationRoutes } from './modules/recommendations/recommendation.routes';

app.use('/vendors', vendorRoutes);
app.use('/vendors/:id/documents', vendorDocumentRoutes);
app.use('/work-requirements', workRequirementRoutes);
app.use('/work-requirements/:id/recommendations', recommendationRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
