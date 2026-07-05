import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";
import { AccessTokenPayload } from "../token/token.service";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload | undefined => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.authUser;
  },
);
