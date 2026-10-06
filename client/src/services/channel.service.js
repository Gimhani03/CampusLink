import api from "./api";

export const getChannels = async (params = {}) => {
  const res = await api.get("/channels", { params });
  return res.data.data; // { channels, pagination }
};

export const getChannelBySlug = async (slug) => {
  const res = await api.get(`/channels/${slug}`);
  return res.data.data.channel;
};

export const toggleFollow = async (channelId) => {
  const res = await api.post(`/channels/${channelId}/follow`);
  return res.data.data; // { following, followerCount }
};

export const getFollowedChannels = async () => {
  const res = await api.get("/channels/following");
  return res.data.data.channels;
};

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

/** Build a FormData payload; falls back to plain JSON when no file is provided. */
const buildBody = (payload, avatarFile) => {
  if (!avatarFile) return payload; // JSON body — no upload needed

  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v !== undefined && v !== null) fd.append(k, String(v));
  });
  fd.append("avatar", avatarFile);
  return fd;
};

/** When body is FormData set the base Content-Type so browser XHR can append
 *  the correct boundary. For plain JSON the header stays as application/json. */
const requestConfig = (body) =>
  body instanceof FormData
    ? { headers: { "Content-Type": "multipart/form-data" } }
    : {};

export const createChannel = async (payload, avatarFile = null) => {
  const body = buildBody(payload, avatarFile);
  const res  = await api.post("/channels", body, requestConfig(body));
  return res.data.data.channel;
};

export const updateChannel = async (id, payload, avatarFile = null) => {
  const body = buildBody(payload, avatarFile);
  const res  = await api.put(`/channels/${id}`, body, requestConfig(body));
  return res.data.data.channel;
};

export const deleteChannel = async (id) => {
  await api.delete(`/channels/${id}`);
};
