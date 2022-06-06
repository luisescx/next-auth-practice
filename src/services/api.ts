import axios, { AxiosError } from "axios";
import Router from "next/router";
import { destroyCookie, parseCookies, setCookie } from "nookies";
import { AuthTokenError } from "./errors/AuthTokenError";

let isRefreshing = false;
let failedRequestsQueue = [];

export function setupAPIClient(ctx = undefined) {
  let cookies = parseCookies(ctx);

  const api = axios.create({
    baseURL: "http://localhost:3333",
    headers: {
      Authorization: `Bearer ${cookies["authPractice.token"]}`,
    },
  });

  api.interceptors.response.use(
    (response) => {
      return response;
    },
    (error: AxiosError) => {
      if (error.response.status === 401) {
        if (error.response.data?.code === "token.expired") {
          cookies = parseCookies(ctx);

          const { "authPractice.refreshToken": refreshToken } = cookies;
          const originalConfig = error.config;

          if (!isRefreshing) {
            isRefreshing = true;

            api
              .post("/refresh", {
                refreshToken,
              })
              .then((response) => {
                const { token } = response.data;

                setCookie(ctx, "authPractice.token", token, {
                  maxAge: 60 * 60 * 24 * 30,
                  path: "/",
                });

                setCookie(
                  ctx,
                  "authPractice.refreshToken",
                  response.data.refreshToken,
                  {
                    maxAge: 60 * 60 * 24 * 30,
                    path: "/",
                  }
                );

                api.defaults.headers["Authorization"] = `Bearer ${token}`;

                failedRequestsQueue.forEach((request) =>
                  request.resolve(token)
                );
                failedRequestsQueue = [];
              })
              .catch((err) => {
                failedRequestsQueue.forEach((request) => request.reject(err));
                failedRequestsQueue = [];

                if (typeof window !== "undefined") {
                  destroyCookie(undefined, "authPractice.token");
                  destroyCookie(undefined, "authPractice.refreshToken");

                  Router.push("/");
                }
              })
              .finally(() => {
                isRefreshing = false;
              });
          }

          return new Promise((resolve, reject) => {
            failedRequestsQueue.push({
              resolve: (token: string) => {
                originalConfig.headers["Authorization"] = `Bearer ${token}`;

                resolve(api(originalConfig));
              },
              reject: (err: AxiosError) => {
                reject(err);
              },
            });
          });
        } else {
          if (typeof window !== "undefined") {
            destroyCookie(undefined, "authPractice.token");
            destroyCookie(undefined, "authPractice.refreshToken");

            Router.push("/");
          } else {
            return Promise.reject(new AuthTokenError());
          }
        }
      }

      return Promise.reject(error);
    }
  );

  return api;
}
