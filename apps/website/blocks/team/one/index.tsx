'use client'

import { useState, useEffect } from 'react'

type TeamMember = {
    id: string
    avatar: string
    name: string
    role: string
    bio: string
}

export default function Team() {
    const [members, setMembers] = useState<TeamMember[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const res = await fetch('/api/team')
                const json = await res.json()
                if (json.success && json.data) setMembers(json.data)
            } catch (err) {
                console.error('Failed to fetch team members:', err)
            } finally {
                setIsLoading(false)
            }
        }
        fetchMembers()
    }, [])

    return (
        <section className="bg-background @container py-24">
            <div className="mx-auto max-w-2xl px-6">
                <div className="space-y-4">
                    <h2 className="text-balance font-serif text-4xl font-medium">Meet Our Founders</h2>
                    <p className="text-muted-foreground text-balance">The visionary leaders behind our mission to transform how teams work and collaborate.</p>
                </div>
                
                {isLoading ? (
                    <div className="mt-12 text-center text-muted-foreground">Loading team members...</div>
                ) : (
                    <div className="mt-12 grid gap-12 text-sm">
                        {members.map((member) => (
                            <div
                                key={member.id}
                                className="relative grid grid-cols-[auto_1fr] gap-4">
                                <div
                                    aria-hidden
                                    className="max-h-26 absolute -inset-x-6 inset-y-1 border-y"
                                />
                                <div
                                    aria-hidden
                                    className="w-26 absolute -inset-y-6 inset-x-1 border-x"
                                />
                                <div className="before:border-foreground/10 shadow-foreground/6.5 dark:shadow-black/6.5 relative size-28 shrink-0 rounded-xl shadow-md before:absolute before:inset-0 before:rounded-xl before:border">
                                    <img
                                        src={member.avatar}
                                        alt={member.name}
                                        className="rounded-xl object-cover"
                                        width={120}
                                        height={120}
                                    />
                                </div>

                                <div className="flex flex-col justify-between gap-6 py-1">
                                    <div className="space-y-0.5">
                                        <p className="text-foregroun text-base font-medium">{member.name}</p>
                                        <p className="text-muted-foreground text-sm">{member.role}</p>
                                    </div>

                                    <p className="text-muted-foreground text-balance text-sm">{member.bio}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}
