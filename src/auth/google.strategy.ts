import { PassportStrategy } from "@nestjs/passport";
import { Strategy, Profile, VerifyCallback } from "passport-google-oauth20";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>("GOOGLE_CLIENT_ID") || "",
      clientSecret: config.get<string>("GOOGLE_CLIENT_SECRET") || "",
      callbackURL: config.get<string>("GOOGLE_CALLBACK_URL") || "",
      scope: ["email", "profile"],
      passReqToCallback: true, // ✅ IMPORTANT (fixes your TS error)
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback
  ) {
    const email = profile.emails?.[0]?.value || "";
    const fullName = profile.displayName || "";

    return done(null, { email, fullName });
  }
}
