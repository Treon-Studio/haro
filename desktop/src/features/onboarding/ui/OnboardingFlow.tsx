import * as React from "react";
import { flushSync } from "react-dom";
import { useUpdateProfileMutation } from "@/features/profile/hooks";
import { useSystemColorScheme } from "@/shared/theme/useSystemColorScheme";
import { Button } from "@/shared/ui/button";
import { StartupWindowDragRegion } from "@/shared/ui/StartupWindowDragRegion";
import { AvatarStep } from "./AvatarStep";
import { OnboardingChrome } from "./OnboardingChrome";
import { OnboardingFooterProvider } from "./OnboardingFooter";
import { LoginForm } from "@/features/auth/ui/LoginForm";
import { RegisterTenantForm } from "@/features/auth/ui/RegisterTenantForm";
import { TenantSelectionStep } from "@/features/auth/ui/TenantSelectionStep";
import { CommunityChangeOverlay } from "@/features/communities/ui/CommunityChangeOverlay";
import {
  type OnboardingTransitionDirection,
  OnboardingSlideTransition,
} from "./OnboardingSlideTransition";
import { ProfileStep } from "./ProfileStep";
import type {
  OnboardingActions,
  OnboardingPage,
  OnboardingProfileSeed,
  OnboardingProfileValues,
  ProfileStepState,
} from "./types";

type OnboardingFlowProps = {
  actions: OnboardingActions;
  identityLost?: boolean;
  initialProfile: OnboardingProfileSeed;
};

function isFallbackDisplayName(value?: string | null) {
  const normalizedValue = value?.trim().toLowerCase() ?? "";
  return (
    normalizedValue.startsWith("npub1") ||
    normalizedValue.startsWith("nostr:npub1")
  );
}

function sanitizeDisplayName(value?: string | null) {
  const trimmedValue = value?.trim() ?? "";
  return isFallbackDisplayName(trimmedValue) ? "" : trimmedValue;
}

function resolveSavedProfile({
  profile,
}: OnboardingProfileSeed): OnboardingProfileValues {
  return {
    avatarUrl: profile?.avatarUrl ?? "",
    displayName: sanitizeDisplayName(profile?.displayName),
  };
}

function createProfileUpdatePayload({
  draftProfile,
  savedProfile,
}: {
  draftProfile: OnboardingProfileValues;
  savedProfile: OnboardingProfileValues;
}) {
  const nextDisplayName = draftProfile.displayName.trim();
  const nextAvatarUrl = draftProfile.avatarUrl.trim();
  const updatePayload: {
    avatarUrl?: string;
    displayName?: string;
  } = {};

  if (
    nextDisplayName.length > 0 &&
    nextDisplayName !== savedProfile.displayName
  ) {
    updatePayload.displayName = nextDisplayName;
  }

  if (nextAvatarUrl.length > 0 && nextAvatarUrl !== savedProfile.avatarUrl) {
    updatePayload.avatarUrl = nextAvatarUrl;
  }

  return updatePayload;
}

function resolveProfileSaveRecovery(
  errorMessage: string | null,
  savedDisplayName: string,
): ProfileStepState["saveRecovery"] {
  return {
    canAdvanceWithoutSaving:
      errorMessage !== null && savedDisplayName.length > 0,
    canSkipForNow: errorMessage !== null && savedDisplayName.length === 0,
    errorMessage,
  };
}

export function OnboardingFlow({
  actions,
  initialProfile,
}: OnboardingFlowProps) {
  const { complete, skipForNow } = actions;
  const savedProfile = resolveSavedProfile(initialProfile);
  const profileUpdateMutation = useUpdateProfileMutation();
  const { error: profileSaveError, isPending: isSavingProfile } =
    profileUpdateMutation;
  // When identity was lost (keyring cleared after migration), land the user
  // directly on the import step with a recovery notice rather than profile setup.
  const [currentPage, setCurrentPage] = React.useState<OnboardingPage>("login");
  const [profileDraft, setProfileDraft] =
    React.useState<OnboardingProfileValues>(savedProfile);
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const [isProfileAdvancePending, setIsProfileAdvancePending] =
    React.useState(false);
  const [isCommunityChangeOpen, setIsCommunityChangeOpen] =
    React.useState(false);
  const [transitionDirection, setTransitionDirection] =
    React.useState<OnboardingTransitionDirection>("forward");
  const systemColorScheme = useSystemColorScheme();

  const resetProfileSaveError = React.useCallback(() => {
    profileUpdateMutation.reset();
  }, [profileUpdateMutation]);

  const updateProfileDraft = React.useCallback(
    (patch: Partial<OnboardingProfileValues>) => {
      resetProfileSaveError();
      setProfileDraft((current) => ({
        ...current,
        ...patch,
      }));
    },
    [resetProfileSaveError],
  );

  const showAvatarPage = React.useCallback(
    (direction: OnboardingTransitionDirection = "forward") => {
      setTransitionDirection(direction);
      setCurrentPage("avatar");
    },
    [],
  );

  const showProfilePage = React.useCallback(() => {
    setTransitionDirection("backward");
    setCurrentPage("profile");
  }, []);

  const showLoginForm = React.useCallback(() => {
    setTransitionDirection("forward");
    setCurrentPage("login");
  }, []);

  const showRegisterForm = React.useCallback(() => {
    setTransitionDirection("forward");
    setCurrentPage("register-tenant");
  }, []);

  const showTenantSelection = React.useCallback(() => {
    setTransitionDirection("forward");
    setCurrentPage("tenant-selection");
  }, []);

  const saveProfileAndContinue = React.useCallback(
    async (nextPage: OnboardingPage | "complete") => {
      if (isProfileAdvancePending) {
        return;
      }
      if (profileDraft.displayName.trim().length === 0) {
        return;
      }

      flushSync(() => {
        setIsProfileAdvancePending(true);
      });

      try {
        // Direct backend: no relay membership check needed.
        const updatePayload = createProfileUpdatePayload({
          draftProfile: profileDraft,
          savedProfile,
        });

        if (Object.keys(updatePayload).length > 0) {
          try {
            await profileUpdateMutation.mutateAsync(updatePayload);
          } catch {
            // Error falls through to the error banner / recovery buttons.
            return;
          }
        }

        if (nextPage === "complete") {
          complete();
          return;
        }
        showAvatarPage();
      } finally {
        setIsProfileAdvancePending(false);
      }
    },
    [
      isProfileAdvancePending,
      profileDraft,
      profileUpdateMutation,
      savedProfile,
      complete,
      showAvatarPage,
    ],
  );

  const updateDisplayNameDraft = React.useCallback(
    (value: string) => {
      updateProfileDraft({ displayName: value });
    },
    [updateProfileDraft],
  );

  const updateAvatarUrlDraft = React.useCallback(
    (value: string) => {
      updateProfileDraft({ avatarUrl: value });
    },
    [updateProfileDraft],
  );

  const resetAvatarDraft = React.useCallback(() => {
    updateProfileDraft({ avatarUrl: savedProfile.avatarUrl });
  }, [savedProfile.avatarUrl, updateProfileDraft]);

  const advanceFromProfileWithoutSaving = React.useCallback(() => {
    profileUpdateMutation.reset();
    setProfileDraft((current) => ({
      ...current,
      displayName: savedProfile.displayName,
    }));
    showAvatarPage();
  }, [profileUpdateMutation, savedProfile.displayName, showAvatarPage]);

  const saveErrorMessage =
    profileSaveError instanceof Error ? profileSaveError.message : null;
  const profileStepState: ProfileStepState = {
    avatar: {
      draftUrl: profileDraft.avatarUrl,
      savedUrl: savedProfile.avatarUrl,
    },
    isUploadingAvatar,
    isSaving: isSavingProfile || isProfileAdvancePending,
    name: {
      draftValue: profileDraft.displayName,
      savedValue: savedProfile.displayName,
    },
    saveRecovery: resolveProfileSaveRecovery(
      saveErrorMessage,
      savedProfile.displayName,
    ),
  };
  const avatarStepState: ProfileStepState = {
    ...profileStepState,
    saveRecovery: saveErrorMessage
      ? {
          canAdvanceWithoutSaving: true,
          canSkipForNow: false,
          errorMessage: saveErrorMessage,
        }
      : profileStepState.saveRecovery,
  };
  // Machine-level identity, backup, and provider setup have already completed.
  // This relay-scoped flow now owns only the community profile.
  const activeSteps: OnboardingPage[] = [
    "login",
    "register-tenant",
    "tenant-selection",
    "profile",
    "avatar",
  ];
  const STEP_OFFSET = 1;
  const normalizedPage: OnboardingPage = currentPage;
  const pageIndex = activeSteps.indexOf(normalizedPage);
  const currentStep = pageIndex >= 0 ? pageIndex + STEP_OFFSET : STEP_OFFSET;
  const totalOnboardingSteps = activeSteps.length;

  return (
    <>
      <div
        className="buzz-onboarding-neutral-theme buzz-startup-shell flex items-start justify-center overflow-y-auto bg-background px-4 pb-28 pt-[106px] text-foreground"
        data-testid="onboarding-gate"
        data-system-color-scheme={systemColorScheme}
      >
        <StartupWindowDragRegion />
        <OnboardingChrome current={currentStep} total={totalOnboardingSteps} />
        <OnboardingFooterProvider>
          <div
            className={`relative flex w-full flex-col items-center text-center ${
              currentPage === "avatar" ? "max-w-[1080px]" : "max-w-[500px]"
            }`}
          >
            {currentPage === "profile" ? (
              <ProfileStep
                actions={{
                  advanceWithoutSaving: advanceFromProfileWithoutSaving,
                  back: () => {
                    setIsCommunityChangeOpen(true);
                  },
                  clearAvatarDraft: resetAvatarDraft,
                  importExistingKey: showLoginForm,
                  onUploadingChange: setIsUploadingAvatar,
                  skipForNow,
                  submit: () => {
                    void saveProfileAndContinue("avatar");
                  },
                  updateAvatarUrl: updateAvatarUrlDraft,
                  updateDisplayName: updateDisplayNameDraft,
                }}
                direction={transitionDirection}
                state={profileStepState}
                usesExistingIdentity
              />
            ) : currentPage === "login" ? (
              <OnboardingSlideTransition
                className="flex w-full flex-col items-center text-center"
                direction={transitionDirection}
                transitionKey="login"
              >
                <div className="w-full max-w-[440px]">
                  <LoginForm onLogin={() => showTenantSelection()} />
                  <Button
                    variant="link"
                    className="mt-4"
                    onClick={showRegisterForm}
                  >
                    Create new organization
                  </Button>
                </div>
              </OnboardingSlideTransition>
            ) : currentPage === "register-tenant" ? (
              <OnboardingSlideTransition
                className="flex w-full flex-col items-center text-center"
                direction={transitionDirection}
                transitionKey="register-tenant"
              >
                <div className="w-full max-w-[440px]">
                  <RegisterTenantForm
                    onRegister={() => showTenantSelection()}
                  />
                  <Button
                    variant="link"
                    className="mt-4"
                    onClick={showLoginForm}
                  >
                    Back to login
                  </Button>
                </div>
              </OnboardingSlideTransition>
            ) : currentPage === "tenant-selection" ? (
              <OnboardingSlideTransition
                className="flex w-full flex-col items-center text-center"
                direction={transitionDirection}
                transitionKey="tenant-selection"
              >
                <div className="w-full max-w-[440px]">
                  <TenantSelectionStep
                    onSelectTenant={() => showProfilePage()}
                  />
                </div>
              </OnboardingSlideTransition>
            ) : (
              <AvatarStep
                actions={{
                  advanceWithoutSaving: complete,
                  back: showProfilePage,
                  onUploadingChange: setIsUploadingAvatar,
                  skipForNow,
                  submit: () => {
                    void saveProfileAndContinue("complete");
                  },
                  updateAvatarUrl: updateAvatarUrlDraft,
                }}
                direction={transitionDirection}
                showAlwaysSkip={true}
                state={avatarStepState}
              />
            )}
          </div>
        </OnboardingFooterProvider>
      </div>
      {isCommunityChangeOpen ? (
        <CommunityChangeOverlay
          onClose={() => setIsCommunityChangeOpen(false)}
        />
      ) : null}
    </>
  );
}
