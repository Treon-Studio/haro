import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@treonstudio/bungas-core/ui/label'

export default function ForgotPassword() {
    return (
        <section className="bg-background flex min-h-screen px-4 py-16 md:py-24">
            <div className="m-auto w-full max-w-xs">
                <div className="text-center">
                    <a
                        href="/"
                        aria-label="go home"
                        className="inline-block py-3">
                        <Logo className="mx-auto w-fit" />
                    </a>
                    <h1 className="mt-3 font-serif text-4xl font-medium">Reset password</h1>
                </div>

                <form
                    action=""
                    className="mt-12 space-y-4">
                    <div className="space-y-2">
                        <Label
                            htmlFor="email"
                            className="text-sm">
                            Email
                        </Label>
                        <Input
                            type="email"
                            id="email"
                            name="email"
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <Button className="w-full">Send Reset Link</Button>
                </form>

                <p className="text-muted-foreground mt-8 text-center text-sm">
                    Remember your password?{' '}
                    <a
                        href="#"
                        className="text-primary font-medium hover:underline">
                        Sign in
                    </a>
                </p>
            </div>
        </section>
    )
}
