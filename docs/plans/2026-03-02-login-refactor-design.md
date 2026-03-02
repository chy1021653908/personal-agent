# Login Page Refactor Design

## Overview
Refactor the `components/auth/login-form.tsx` component to match a modern, card-based design using standard Shadcn UI components. The goal is to improve the visual aesthetic while maintaining existing authentication functionality.

## Goals
-   Update UI to match the provided example using standard Shadcn components (`Card`, `Label`, `Input`, `Button`).
-   Remove dependency on non-standard `Field` components in favor of utility classes.
-   Maintain existing email/password login logic.
-   Add visual elements for "Login with Google" and "Forgot Password".

## Architecture

### Component Structure
The `LoginForm` will be restructured as follows:

```tsx
<div className={cn("flex flex-col gap-6", className)} {...props}>
  <Card>
    <CardHeader>
      <CardTitle>Login to your account</CardTitle>
      <CardDescription>Enter your email below to login to your account</CardDescription>
    </CardHeader>
    <CardContent>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-6"> {/* Replaces FieldGroup */}
          
          {/* Email Field */}
          <div className="grid gap-2"> {/* Replaces Field */}
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="m@example.com" required />
          </div>

          {/* Password Field */}
          <div className="grid gap-2"> {/* Replaces Field */}
            <div className="flex items-center">
              <Label htmlFor="password">Password</Label>
              <a href="#" className="ml-auto inline-block text-sm underline-offset-4 hover:underline">
                Forgot your password?
              </a>
            </div>
            <Input id="password" type="password" required />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button type="submit" className="w-full">Login</Button>
            <Button variant="outline" type="button" className="w-full">
              Login with Google
            </Button>
          </div>

          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <a href="#" className="underline underline-offset-4">Sign up</a>
          </div>
          
        </div>
      </form>
    </CardContent>
  </Card>
</div>
```

### Logic Integration
-   **Email Login**: Retain existing `signIn.email` call in `handleSubmit`.
-   **Google Login**: Add `signIn.social({ provider: "google" })` to the Google button (if configured), otherwise keep as UI placeholder or log "Not implemented".
-   **State Management**: Keep `email`, `password`, `loading`, `error` states.

## Plan
1.  Backup `components/auth/login-form.tsx` (or just refactor in place safely).
2.  Update imports to ensure `Label`, `Input`, `Button`, `Card` components are available.
3.  Rewrite JSX structure to match the design above.
4.  Re-attach event handlers and state values.
5.  Verify "Login with Google" button exists (will add basic `onClick` handler).
