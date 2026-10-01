import type { SignIn } from "@clerk/nextjs";
import type { ComponentProps } from "react";

export const hedgeAppearance: ComponentProps<typeof SignIn>["appearance"] = {
  variables: {
    colorPrimary: "#f2b441",
    colorPrimaryForeground: "#0a0a0b",
    colorBackground: "#060607",
    colorForeground: "#fafafa",
    colorMutedForeground: "#71717a",
    colorInput: "#0e0e16",
    colorInputForeground: "#fafafa",
    colorDanger: "#ff4a31",
    colorNeutral: "#fafafa",
    borderRadius: "9px",
    fontFamily: "var(--font-geist-sans)",
    fontSize: "15px",
  },
  options: {
    socialButtonsVariant: "blockButton",
    socialButtonsPlacement: "top",
    unsafe_disableDevelopmentModeWarnings: true,
  },
  elements: {
    rootBox: "w-full max-w-[400px]",
    cardBox: "shadow-none border-0 w-full",
    card: "bg-transparent shadow-none p-0 gap-[22px]",
    header: "items-start text-left gap-2",
    headerTitle: "text-[28px] font-semibold tracking-[-0.035em] text-chalk",
    headerSubtitle: "text-[15px] text-chalk-faint",
    socialButtons: "grid grid-cols-2 gap-2.5 max-lg:grid-cols-1 has-[>:only-child]:grid-cols-1",
    socialButtonsBlockButton:
      "h-11 max-lg:h-12 border border-hairline-2 bg-field hover:bg-raised rounded-[9px] text-sm font-medium text-chalk",
    socialButtonsBlockButtonText: "font-medium",
    dividerLine: "bg-hairline",
    dividerText: "font-mono text-[10px] tracking-[0.2em] uppercase text-chalk-muted",
    formFieldLabel: "font-mono text-[11px] tracking-[0.16em] uppercase text-chalk-dim",
    formFieldInput:
      "h-[46px] max-lg:h-12 bg-input-bg border border-[#262633] rounded-[9px] px-3.5 font-mono text-sm text-chalk placeholder:text-[#4a4a58] focus:border-hedge focus:ring-[3px] focus:ring-hedge/15",
    formButtonPrimary:
      "h-[46px] max-lg:h-12 bg-hedge hover:bg-[#f5c566] text-[#0a0a0b] text-[15px] font-semibold normal-case rounded-[9px] shadow-none",
    footer: "bg-transparent bg-none [&>*:last-child]:hidden",
    footerItem: "border-0 p-0",
    footerAction: "justify-center p-0 mt-2",
    footerActionText: "text-sm text-chalk-faint",
    footerActionLink: "text-sm font-medium text-hedge hover:text-[#f5c566]",
    identityPreviewEditButton: "text-hedge",
    formResendCodeLink: "text-hedge",
    otpCodeFieldInput: "bg-input-bg border-[#262633] font-mono text-chalk",
    alertText: "text-regret",
  },
};
