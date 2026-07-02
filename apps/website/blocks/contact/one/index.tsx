'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@treonstudio/bungas-core/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LetterLinear, MapPointLinear, PhoneLinear } from 'solar-icon-set';

export default function Contact() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setIsSuccess(false);

        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            subject: formData.get('subject'),
            message: formData.get('message'),
        };

        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                setIsSuccess(true);
                (e.target as HTMLFormElement).reset();
            } else {
                const errData = await res.json();
                setError(errData.error || 'Failed to send message');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className="bg-background @container py-24">
            <div className="mx-auto max-w-3xl px-6">
                <div>
                    <h1 className="text-balance font-serif text-4xl font-medium sm:text-5xl">Get in Touch</h1>
                    <p className="text-muted-foreground mt-4 max-w-md text-balance">Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.</p>
                </div>

                <div className="@xl:grid-cols-5 mt-12 grid gap-8">
                    <div className="@xl:col-span-2 space-y-6 *:space-y-2">
                        <div>
                            <p className="text-foreground text-sm font-medium">Email</p>
                            <a
                                href="mailto:hello@example.com"
                                className="text-muted-foreground hover:text-primary text-sm">
                                hello@example.com
                            </a>
                        </div>

                        <div>
                            <p className="text-foreground text-sm font-medium">PhoneLinear</p>
                            <a
                                href="tel:+1234567890"
                                className="text-muted-foreground hover:text-primary text-sm">
                                +1 (234) 567-890
                            </a>
                        </div>

                        <div>
                            <p className="text-foreground text-sm font-medium">Office</p>
                            <p className="text-muted-foreground text-sm">123 Main Street, San Francisco, CA 94102</p>
                        </div>
                    </div>

                    <Card
                        variant="outline"
                        className="@xl:col-span-3 p-6">
                        {isSuccess ? (
                            <div className="flex h-full flex-col items-center justify-center space-y-4 text-center py-12">
                                <div className="rounded-full bg-green-500/10 p-3 text-green-500">
                                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-foreground">Message Sent!</h3>
                                    <p className="text-sm text-muted-foreground mt-2">Thank you for reaching out. We'll get back to you shortly.</p>
                                </div>
                                <Button variant="outline" className="mt-4" onClick={() => setIsSuccess(false)}>Send another message</Button>
                            </div>
                        ) : (
                            <form
                                onSubmit={handleSubmit}
                                className="space-y-5">
                                {error && (
                                    <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-500">
                                        {error}
                                    </div>
                                )}
                                <div className="@md:grid-cols-2 grid gap-4">
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="name"
                                            className="text-sm">
                                            Name
                                        </Label>
                                        <Input
                                            type="text"
                                            id="name"
                                            name="name"
                                            placeholder="Your name"
                                            required
                                        />
                                    </div>
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
                                </div>

                                <div className="space-y-2">
                                    <Label
                                        htmlFor="subject"
                                        className="text-sm">
                                        Subject
                                    </Label>
                                    <Input
                                        type="text"
                                        id="subject"
                                        name="subject"
                                        placeholder="How can we help?"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label
                                        htmlFor="message"
                                        className="text-sm">
                                        Message
                                    </Label>
                                    <Textarea
                                        id="message"
                                        name="message"
                                        rows={4}
                                        placeholder="Tell us more..."
                                        required
                                        className="min-h-28"
                                    />
                                </div>

                                <Button disabled={isLoading} className="w-full">
                                    {isLoading ? 'Sending...' : 'Send Message'}
                                </Button>
                            </form>
                        )}
                    </Card>
                </div>
            </div>
        </section>
    )
}
