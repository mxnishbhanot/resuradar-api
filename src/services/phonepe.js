import axios from "axios";
import { config, getPhonepeOAuthTokenUrl } from "../config/config.js";

export const generateAuthToken = async () => {
  const authPayload = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    client_version: config.clientVersion,
    grant_type: "client_credentials",
  });

  const authResponse = await axios.post(getPhonepeOAuthTokenUrl(), authPayload, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15000,
  });

  return authResponse.data.access_token;
};
