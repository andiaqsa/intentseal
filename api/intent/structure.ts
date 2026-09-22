import { handleStructureIntent } from "../../server/intent/route";

export const config = { maxDuration: 20 };

export default {
  fetch(request: Request): Promise<Response> {
    return handleStructureIntent(request);
  },
};
