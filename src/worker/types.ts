export type Env = {
  DB: D1Database;
  PHOTOS: R2Bucket;
  ASSETS: Fetcher;
  INVITE_CODE?: string;
};

export type User = {
  id: number;
  phone: string;
  name: string;
};

export type Vars = {
  user: User;
};
