# Login Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Refactor `components/auth/login-form.tsx` to use standard Shadcn UI components and match the design spec.

**Architecture:** Replace custom `Field` components with standard `Label` and utility classes within a `Card` layout.

**Tech Stack:** React, Next.js, Shadcn UI, Tailwind CSS.

---

### Task 1: Setup & Imports

**Files:**
- Modify: `components/auth/login-form.tsx`

**Step 1: Check existing imports**
Read `components/auth/login-form.tsx` to see current imports.

**Step 2: Update imports**
Ensure the following are imported:
```typescript
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
```

**Step 3: Commit**
```bash
git add components/auth/login-form.tsx
git commit -m "refactor(auth): update imports for standard shadcn components"
```

### Task 2: Refactor Component Structure

**Files:**
- Modify: `components/auth/login-form.tsx`

**Step 1: Refactor JSX**
Replace the entire `return` statement with the new structure.

*Crucial:* Keep the `onSubmit={handleSubmit}` on the `<form>`.
*Crucial:* Bind `value={email}` and `onChange` to the Email input.
*Crucial:* Bind `value={password}` and `onChange` to the Password input.
*Crucial:* Keep the `disabled={loading}` on the submit button.

```tsx
return (
  <div className={cn("flex flex-col gap-6", className)} {...props}>
    <Card>
      <CardHeader>
        <CardTitle>Login to your account</CardTitle>
        <CardDescription>
          Enter your email below to login to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <a
                  href="#"
                  className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                >
                  Forgot your password?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
            
            <Button variant="outline" type="button" className="w-full">
              Login with Google
            </Button>
          </div>
          
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="underline underline-offset-4">
              Sign up
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
)
```

**Step 2: Update Component Props**
Update the component signature to accept props if needed (for `className` support):
```typescript
export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  // ... existing hooks
```

**Step 3: Commit**
```bash
git add components/auth/login-form.tsx
git commit -m "refactor(auth): reimplement login form with standard shadcn components"
```

### Task 3: Verify and Cleanup

**Files:**
- Modify: `components/auth/login-form.tsx`

**Step 1: Check for unused imports**
Run linter or check manually for unused imports (e.g. `CardFooter` might be unused now).

**Step 2: Fix lint errors**
Remove unused imports.

**Step 3: Commit**
```bash
git add components/auth/login-form.tsx
git commit -m "refactor(auth): cleanup unused imports"
```
