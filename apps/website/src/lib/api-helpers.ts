import type { APIContext } from "astro";
import { Effect, pipe } from "effect";
import {
	AgentsRepository,
	makeNeonAgentsRepository,
} from "@/domain/agents/index";
import {
	IAnalyticsRepository,
	makeNeonAnalyticsRepository,
} from "@/domain/analytics/index";
import { makeNeonAuthRepository } from "@/domain/auth/auth.repository.neon";
import { IAuthRepository } from "@/domain/auth/index";
import {
	IBillingRepository,
	makeNeonBillingRepository,
} from "@/domain/billing/index";
import {
	IBrandingRepository,
	makeNeonBrandingRepository,
} from "@/domain/branding/index";
import {
	ICompaniesRepository,
	makeNeonCompaniesRepository,
} from "@/domain/companies/index";
import {
	ICompanyAdminOpsRepository,
	makeNeonCompanyAdminOpsRepository,
} from "@/domain/company-admin-ops/index";
import {
	IInvitationsRepository,
	makeNeonInvitationsRepository,
} from "@/domain/invitations/index";
import {
	INotificationsRepository,
	makeNeonNotificationsRepository,
} from "@/domain/notifications/index";
import {
	IProfilesRepository,
	makeNeonProfilesRepository,
} from "@/domain/profiles/index";
import {
	IProjectsRepository,
	makeNeonProjectsRepository,
} from "@/domain/projects/index";
import {
	IPromptsRepository,
	makeNeonPromptsRepository,
} from "@/domain/prompts/index";
import {
	ISafetyRepository,
	makeNeonSafetyRepository,
} from "@/domain/safety/index";
import {
	ISkillsRepository,
	makeNeonSkillsRepository,
} from "@/domain/skills/index";
import {
	ISuperAdminRepository,
	makeNeonSuperAdminRepository,
} from "@/domain/super-admin/index";
import {
	ISuperAdminOpsRepository,
	makeNeonSuperAdminOpsRepository,
} from "@/domain/super-admin-ops/index";
import type { TApiMeta, TApiResponse } from "@/shared/types/common.types";

export const makeMeta = (): TApiMeta => ({
	requestId: crypto.randomUUID(),
	timestamp: new Date().toISOString(),
});

export const jsonOk = <T>(data: T, meta: TApiMeta, status = 200): Response =>
	Response.json({ success: true, data, meta } as TApiResponse<T>, { status });

export const jsonError = (
	error: { _tag: string; message: string },
	meta: TApiMeta,
	status: number,
): Response =>
	Response.json({ success: false, error, meta } as TApiResponse<never>, {
		status,
	});

const logError = (logger: any, span: string, err: any) => {
	const tag = err?._tag ?? err?.name ?? "UnknownError";
	const msg = err?.message ?? String(err);
	logger?.error?.(
		`api:${span} failed`,
		{ action: span, errorTag: tag, errorMessage: msg },
		err instanceof Error ? err : undefined,
	);
};

export const runAuthEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<
		A,
		{ _tag: string; message: string },
		IAuthRepository | IInvitationsRepository
	>,
): Promise<A> => {
	const neonAuthRepo = makeNeonAuthRepository(context);
	const neonInvRepo = makeNeonInvitationsRepository(context);
	const logger = context.locals.logger;
	const traced = effect.pipe(
		Effect.provideService(IAuthRepository, neonAuthRepo),
		Effect.provideService(IInvitationsRepository, neonInvRepo),
		Effect.tapError((err) => Effect.sync(() => logError(logger, "auth", err))),
	);
	return logger?.withSpan
		? Effect.runPromise(logger.withSpan("auth", () => traced))
		: Effect.runPromise(traced);
};

export const runProjectsEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<
		A,
		{ _tag: string; message: string },
		IProjectsRepository
	>,
): Promise<A> => {
	const neonRepo = makeNeonProjectsRepository(context);
	const logger = context.locals.logger;
	const traced = effect.pipe(
		Effect.provideService(IProjectsRepository, neonRepo),
		Effect.tapError((err) =>
			Effect.sync(() => logError(logger, "projects", err)),
		),
	);
	return logger?.withSpan
		? Effect.runPromise(logger.withSpan("projects", () => traced))
		: Effect.runPromise(traced);
};

export const runSkillsEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<
		A,
		{ _tag: string; message: string },
		ISkillsRepository
	>,
): Promise<A> => {
	const neonRepo = makeNeonSkillsRepository(context);
	const logger = context.locals.logger;
	const traced = effect.pipe(
		Effect.provideService(ISkillsRepository, neonRepo),
		Effect.tapError((err) =>
			Effect.sync(() => logError(logger, "skills", err)),
		),
	);
	return logger?.withSpan
		? Effect.runPromise(logger.withSpan("skills", () => traced))
		: Effect.runPromise(traced);
};

export const runPromptsEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<
		A,
		{ _tag: string; message: string },
		IPromptsRepository
	>,
): Promise<A> => {
	const neonRepo = makeNeonPromptsRepository(context);
	const logger = context.locals.logger;
	const traced = effect.pipe(
		Effect.provideService(IPromptsRepository, neonRepo),
		Effect.tapError((err) =>
			Effect.sync(() => logError(logger, "prompts", err)),
		),
	);
	return logger?.withSpan
		? Effect.runPromise(logger.withSpan("prompts", () => traced))
		: Effect.runPromise(traced);
};

const runRepoEffect = <A>(
	context: APIContext,
	span: string,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const logger = context.locals.logger;
	const traced = effect.pipe(
		Effect.tapError((err) => Effect.sync(() => logError(logger, span, err))),
	);
	return logger?.withSpan
		? Effect.runPromise(logger.withSpan(span, () => traced) as any)
		: Effect.runPromise(traced as any);
};

export const runAgentsEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const repo = makeNeonAgentsRepository(context);
	return runRepoEffect(
		context,
		"agents",
		effect.pipe(Effect.provideService(AgentsRepository, repo)),
	);
};

export const runInvitationsEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const neonRepo = makeNeonInvitationsRepository(context);
	return runRepoEffect(
		context,
		"invitations",
		effect.pipe(Effect.provideService(IInvitationsRepository, neonRepo)),
	);
};

export const runProfilesEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const repo = makeNeonProfilesRepository(context);
	return runRepoEffect(
		context,
		"profiles",
		effect.pipe(Effect.provideService(IProfilesRepository, repo)),
	);
};

export const runCompaniesEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const neonRepo = makeNeonCompaniesRepository(context);
	return runRepoEffect(
		context,
		"companies",
		effect.pipe(Effect.provideService(ICompaniesRepository, neonRepo)),
	);
};

export const runSuperAdminEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const repo = makeNeonSuperAdminRepository(context);
	return runRepoEffect(
		context,
		"super-admin",
		effect.pipe(Effect.provideService(ISuperAdminRepository, repo)),
	);
};

export const runBrandingEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const neonRepo = makeNeonBrandingRepository(context);
	return runRepoEffect(
		context,
		"branding",
		effect.pipe(Effect.provideService(IBrandingRepository, neonRepo)),
	);
};

export const runBillingEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const neonRepo = makeNeonBillingRepository(context);
	return runRepoEffect(
		context,
		"billing",
		effect.pipe(Effect.provideService(IBillingRepository, neonRepo)),
	);
};

export const runSafetyEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const neonRepo = makeNeonSafetyRepository(context);
	return runRepoEffect(
		context,
		"safety",
		effect.pipe(Effect.provideService(ISafetyRepository, neonRepo)),
	);
};

export const runAnalyticsEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const neonRepo = makeNeonAnalyticsRepository(context);
	return runRepoEffect(
		context,
		"analytics",
		effect.pipe(Effect.provideService(IAnalyticsRepository, neonRepo)),
	);
};

export const runSuperAdminOpsEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const repo = makeNeonSuperAdminOpsRepository(context);
	return runRepoEffect(
		context,
		"super-admin-ops",
		effect.pipe(Effect.provideService(ISuperAdminOpsRepository, repo)),
	);
};

export const runCompanyAdminOpsEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const repo = makeNeonCompanyAdminOpsRepository(context);
	return runRepoEffect(
		context,
		"company-admin-ops",
		effect.pipe(
			Effect.provideService(ICompanyAdminOpsRepository, repo),
		),
	);
};

export const runNotificationsEffect = <A>(
	context: APIContext,
	effect: Effect.Effect<A, any, any>,
): Promise<A> => {
	const neonRepo = makeNeonNotificationsRepository(context);
	return runRepoEffect(
		context,
		"notifications",
		effect.pipe(Effect.provideService(INotificationsRepository, neonRepo)),
	);
};
