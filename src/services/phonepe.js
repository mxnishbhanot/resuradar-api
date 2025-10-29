import { config } from "../config/config.js";
import axios from "axios";

// Helper function to generate auth token for PhonePe API
export const generateAuthToken = async () => {
    const authPayload = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        client_version: config.clientVersion || '1.0',
        grant_type: 'client_credentials'
    });

    const authResponse = await axios.post(
        `https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token`,
        authPayload,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    return authResponse.data.access_token;
};
