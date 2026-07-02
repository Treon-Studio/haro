import React from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { HeroHeader } from './header'
import { MusicNoteLinear, AltArrowRightLinear, ChatRoundLinear, Microphone3Linear, AddCircleLinear } from 'solar-icon-set';
import { Supabase } from '@/components/ui/svgs/supabase'
import { Slack } from '@/components/ui/svgs/slack'
import { Twilio } from '@/components/ui/svgs/twilio'
import { Linear } from '@/components/ui/svgs/linear'
import { Figma } from '@/components/ui/svgs/figma'
import { Vercel } from '@/components/ui/svgs/vercel'
import { Firebase } from '@/components/ui/svgs/firebase'
import { ClerkIconLight as Clerk } from '@/components/ui/svgs/clerk'
import { Claude } from '@/components/ui/svgs/claude'

export default function HeroSection() {
    return (
        <>
            <HeroHeader />
            <main className="overflow-hidden">
                <section className="bg-background">
                    <div className="relative py-40">
                        <div className="mask-radial-from-45% mask-radial-to-75% mask-radial-at-top mask-radial-[75%_100%] aspect-2/3 absolute inset-0 opacity-75 blur-xl md:aspect-square lg:aspect-video dark:opacity-5">
                            <img
                                src="https://images.unsplash.com/photo-1685013640715-8701bbaa2207?q=80&w=2198&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                                alt="hero background"
                                width={2198}
                                height={1685}
                                className="h-full w-full object-cover object-top"
                            />
                        </div>
                        <div className="relative z-10 mx-auto w-full max-w-5xl sm:pl-6">
                            <div className="flex items-center justify-between max-md:flex-col">
                                <div className="max-w-md max-sm:px-6">
                                    <h1 className="text-balance font-serif text-4xl font-medium sm:text-5xl">Ship faster. Integrate smarter.</h1>
                                    <p className="text-muted-foreground mt-4 text-balance">Veil is your all-in-one engine for adding seamless integrations to your app.</p>

                                    <Button
                                        asChild
                                        className="mt-6 pr-1.5">
                                        <a href="/sign-up">
                                            <span className="text-nowrap">Start Building</span>
                                            <AltArrowRightLinear className="opacity-50" />
                                        </a>
                                    </Button>
                                </div>
                                <div
                                    aria-hidden
                                    className="mask-y-from-50% relative max-md:mx-auto max-md:*:scale-90">
                                    {[
                                        'How do I integrate Supabase authentication?',
                                        'Set up real-time subscriptions with Firebase',
                                        'Connect Slack notifications to my app',
                                        'Implement Twilio SMS verification',
                                        'Add Linear issue tracking integration',
                                        'Set up Figma design sync',
                                        'Deploy to Vercel with environment variables',
                                        'Configure Clerk user management',
                                        'Build an AI assistant with Claude',
                                        'Create a webhook endpoint for Stripe',
                                        'Set up OAuth with multiple providers',
                                        'Implement rate limiting for API endpoints',
                                    ].map((prompt, index) => (
                                        <div
                                            key={index}
                                            className="text-muted-foreground flex items-center gap-2 px-14 py-2 text-sm">
                                            <ChatRoundLinear className="size-3.5 opacity-50" />
                                            <span className="text-nowrap">{prompt}</span>
                                        </div>
                                    ))}
                                    <div className="bg-card min-w-sm ring-border shadow-foreground/6.5 dark:shadow-black/6.5 absolute inset-0 m-auto mt-auto flex h-fit justify-between gap-3 rounded-full p-2 shadow-xl ring-1 sm:inset-2">
                                        <div className="flex items-center gap-2">
                                            <div className="hover:bg-muted flex size-9 cursor-pointer rounded-full *:m-auto *:size-4">
                                                <AddCircleLinear />
                                            </div>
                                            <div className="text-muted-foreground text-sm">Ask anything...</div>
                                        </div>
                                        <div className="flex items-center gap-0.5">
                                            <div className="hover:bg-muted flex size-9 cursor-pointer rounded-full *:m-auto *:size-4">
                                                <Microphone3Linear />
                                            </div>
                                            <div className="bg-foreground text-background flex size-9 cursor-pointer rounded-full *:m-auto *:size-4 hover:brightness-110">
                                                <MusicNoteLinear />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}
