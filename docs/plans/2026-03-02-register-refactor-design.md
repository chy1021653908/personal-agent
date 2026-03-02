# Register Page Refactor Design

## Overview
Refactor `components/auth/register-form.tsx` to align with the newly refactored login page design. This ensures visual consistency across the authentication flow.

## Goals
-   Update UI to match the login page style using standard Shadcn components.
-   Use `grid gap-2` for field layouts.
-   Include "Sign up with Google" as a placeholder (optional but good for consistency if login has it).
-   Improve layout of action buttons and links.

## Architecture

### Component Structure
The `RegisterForm` will be restructured as follows:

```tsx
<div className={cn("flex flex-col gap-6", className)} {...props}>
  <Card>
    <CardHeader>
      <CardTitle className="text-2xl text-center">Create an account</CardTitle>
      <CardDescription className="text-center">Enter your details below to create your account</CardDescription>
    </CardHeader>
    <CardContent>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-6">
          
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Name Field */}
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" type="text" placeholder="John Doe" required />
          </div>

          {/* Email Field */}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="m@example.com" required />
          </div>

          {/* Password Field */}
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required />
          </div>

          {/* Confirm Password Field */}
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input id="confirmPassword" type="password" required />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button type="submit" className="w-full">Sign Up</Button>
            <Button variant="outline" type="button" className="w-full">
              Sign up with Google
            </Button>
          </div>

          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="underline underline-offset-4">Log in</Link>
          </div>
          
        </div>
      </form>
    </CardContent>
  </Card>
</div>
```

## Plan
1.  Update imports in `components/auth/register-form.tsx`.
2.  Rewrite the JSX structure.
3.  Verify state and handlers are correctly wired up.
4.  Commit changes.
