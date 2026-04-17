import { config } from "../config/config.js";

export function userHasActivePremium(user) {
  if (!user) return false;
  const now = Date.now();
  const until = user.premiumUntil ? new Date(user.premiumUntil).getTime() : 0;
  if (until > now) {
    if (user.subscriptionStatus === "revoked") return false;
    return true;
  }
  if (user.isPremium === true && !user.premiumUntil) {
    return true;
  }
  return false;
}

export function getFreeStandardAnalysisLimit() {
  return config.freeStandardAnalysisLimit;
}

export function getFreeJdMatchLimit() {
  return config.freeJdMatchLimit;
}

export function getStandardAnalysesBeforeWow() {
  return config.standardAnalysesBeforeWow;
}

export function getFreeBuilderTemplates() {
  return config.freeBuilderTemplates;
}

export function isFreeBuilderTemplate(template) {
  return config.freeBuilderTemplates.includes(template);
}

export function getSubscriptionPeriodMs() {
  return config.subscriptionPeriodDays * 24 * 60 * 60 * 1000;
}

export function extendPremiumUntil(fromDate = new Date()) {
  return new Date(fromDate.getTime() + getSubscriptionPeriodMs());
}

/** Extend subscription window from the later of "now" or existing premiumUntil. */
export function extendPremiumFromUser(user) {
  const now = Date.now();
  const currentUntil = user?.premiumUntil ? new Date(user.premiumUntil).getTime() : 0;
  const base = currentUntil > now ? new Date(currentUntil) : new Date();
  return extendPremiumUntil(base);
}
