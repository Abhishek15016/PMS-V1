import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { CommonModule } from "./common/common.module";
import { TenantContextMiddleware } from "./common/middleware/tenant-context.middleware";
import { TokenModule } from "./common/token/token.module";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { InstitutionsModule } from "./modules/institutions/institutions.module";
import { MentorshipModule } from "./modules/mentorship/mentorship.module";
import { OperatorModule } from "./modules/operator/operator.module";
import { ResumesModule } from "./modules/resumes/resumes.module";
import { ApplicationsModule } from "./modules/applications/applications.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { DrivesModule } from "./modules/drives/drives.module";
import { EligibilityModule } from "./modules/eligibility/eligibility.module";
import { JobDescriptionsModule } from "./modules/job-descriptions/job-descriptions.module";
import { MeModule } from "./modules/me/me.module";
import { OffersModule } from "./modules/offers/offers.module";
import { PolicyModule } from "./modules/policy/policy.module";
import { StudentsModule } from "./modules/students/students.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // A plain options object, not a pre-built IORedis instance: BullMQ
      // constructs and owns its own connections from this, so it actually
      // closes them on shutdown. A raw IORedis instance passed in directly
      // is NOT owned by BullMQ and is never closed, leaking the connection
      // (and leaving e2e tests hanging without --forceExit).
      useFactory: (config: ConfigService) => {
        const url = new URL(config.getOrThrow<string>("REDIS_URL"));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
            maxRetriesPerRequest: null,
            // rediss: (Upstash and most managed Redis hosts) requires TLS;
            // ioredis only enables it when explicitly told to, even though
            // the URL scheme says so.
            ...(url.protocol === "rediss:" ? { tls: {} } : {}),
          },
        };
      },
    }),
    TokenModule,
    CommonModule,
    DatabaseModule,
    AuthModule,
    MeModule,
    StudentsModule,
    CompaniesModule,
    JobDescriptionsModule,
    DrivesModule,
    PolicyModule,
    EligibilityModule,
    OffersModule,
    ApplicationsModule,
    AnalyticsModule,
    InstitutionsModule,
    ResumesModule,
    MentorshipModule,
    OperatorModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes("*");
  }
}
