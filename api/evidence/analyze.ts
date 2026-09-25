import { handleEvidenceAnalysis } from "../../server/evidence/route";

export const config = { maxDuration: 60 };

export default {
  fetch(request: Request): Promise<Response> {
    return handleEvidenceAnalysis(request);
  },
};
