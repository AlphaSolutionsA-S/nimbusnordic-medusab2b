import {
  IAuthModuleService,
  IUserModuleService,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import jwt from "jsonwebtoken";
import Scrypt from "scrypt-kdf";

export const adminHeaders = {
  headers: {},
};

export const createAdminUser = async (adminHeaders, appContainer) => {
  const userModule: IUserModuleService = appContainer.resolve(Modules.USER);
  const authModule: IAuthModuleService = appContainer.resolve(Modules.AUTH);
  const user = await userModule.createUsers({
    first_name: "Admin",
    last_name: "User",
    email: "admin@medusa.js",
  });

  const hashConfig = { logN: 15, r: 8, p: 1 };
  const passwordHash = await Scrypt.kdf("somepassword", hashConfig);

  const authIdentity = await authModule.createAuthIdentities({
    provider_identities: [
      {
        provider: "emailpass",
        entity_id: "admin@medusa.js",
        provider_metadata: {
          password: passwordHash.toString("base64"),
        },
      },
    ],
    app_metadata: {
      user_id: user.id,
    },
  });

  const token = jwt.sign(
    {
      actor_id: user.id,
      actor_type: "user",
      auth_identity_id: authIdentity.id,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );

  adminHeaders.headers["authorization"] = `Bearer ${token}`;

  return { user, authIdentity };
};

/**
 * Logs the user from createAdminUser in through the real auth routes and returns the Admin
 * dashboard's credential: the signed session cookie only, no bearer header.
 */
export const createAdminSession = async (api) => {
  const { token } = (
    await api.post("/auth/user/emailpass", {
      email: "admin@medusa.js",
      password: "somepassword",
    })
  ).data;
  const session = await api.post("/auth/session", {}, {
    headers: { authorization: `Bearer ${token}` },
  });
  const cookie = (session.headers["set-cookie"] ?? [])
    .map((value: string) => value.split(";")[0])
    .find((value: string) => value.startsWith("connect.sid="));
  if (!cookie) {
    throw new Error("Login did not set a session cookie");
  }
  return { headers: { cookie } as Record<string, string> };
};

export const createStoreUser = async ({ api, storeHeaders, email = "test@email.com" }) => {
  const registerToken = (
    await api.post("/auth/customer/emailpass/register", {
      email,
      password: "password",
    })
  ).data.token;

  const customer = (
    await api.post(
      "/store/customers",
      {
        email,
      },
      {
        headers: {
          Authorization: `Bearer ${registerToken}`,
          ...storeHeaders.headers,
        },
      }
    )
  ).data.customer;

  const token = (
    await api.post("/auth/customer/emailpass", {
      email,
      password: "password",
    })
  ).data.token;

  return { customer, token };
};
