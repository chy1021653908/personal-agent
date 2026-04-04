import { RegisterForm } from "@/components/auth/register-form";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <RegisterForm />
    </div>
  );
}
