/**
 * Public pass API — token in URL is the credential.
 */

import api from "./api";

export const getPublicPass = async (token) => {
  const { data } = await api.get(`/passes/${encodeURIComponent(token)}`);
  return data.data.pass;
};
