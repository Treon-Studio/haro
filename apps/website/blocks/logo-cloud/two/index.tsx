'use client'
import React, { useEffect, useState } from 'react'

import { AnisAI } from '@/components/ui/svgs/anis-ai'
import { Bolt } from '@/components/ui/svgs/bolt'
import { Cisco } from '@/components/ui/svgs/cisco'
import { Hulu } from '@/components/ui/svgs/hulu'
import { Supabase } from '@/components/ui/svgs/supabase'
import { AnimatePresence, motion } from 'motion/react'
import { VercelFull } from '@/components/ui/svgs/vercel'
import { Spotify } from '@/components/ui/svgs/spotify'

type LogoGroup = 'ai' | 'hosting' | 'payments' | 'streaming'

const getLogos = (group: LogoGroup): React.ReactNode[] => {
    switch (group) {
        case 'ai':
            return [
                <Bolt key="bolt" className="h-3.5 w-full" />,
                <AnisAI key="anis-ai" className="h-3.5 w-full" />,
                <Hulu key="hulu" className="h-3.5 w-full" />,
            ]
        case 'hosting':
            return [
                <Supabase key="supabase" className="size-5" />,
                <Spotify key="spotify" className="h-5 w-full" />,
                <VercelFull key="vercel" className="h-3.5 w-full" />,
            ]
        case 'payments':
            return [
                <Hulu key="hulu" className="h-3.5 w-full" />,
                <VercelFull key="vercel" className="h-3.5 w-full" />,
                <Spotify key="spotify" className="h-5 w-full" />,
            ]
        case 'streaming':
            return [
                <Cisco key="cisco" className="h-5 w-full" />,
                <Hulu key="hulu" className="h-3.5 w-full" />,
                <Spotify key="spotify" className="h-5 w-full" />,
            ]
    }
}

export default function LogoCloud() {
    const [currentGroup, setCurrentGroup] = useState<LogoGroup>('ai')

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentGroup((prev) => {
                const groups: LogoGroup[] = ['ai', 'hosting', 'payments', 'streaming']
                const currentIndex = groups.indexOf(prev)
                const nextIndex = (currentIndex + 1) % groups.length
                return groups[nextIndex]
            })
        }, 2500)

        return () => clearInterval(interval)
    }, [])

    return (
        <section className="bg-background py-12">
            <div className="mx-auto max-w-5xl px-6">
                <div className="mx-auto grid h-8 max-w-2xl grid-cols-3 items-center gap-8">
                    <AnimatePresence
                        initial={false}
                        mode="popLayout">
                        {getLogos(currentGroup).map((logo, i) => (
                            <motion.div
                                key={`${currentGroup}-${i}`}
                                className="**:fill-foreground! flex items-center justify-center"
                                initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
                                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: 12, filter: 'blur(6px)', scale: 0.5 }}
                                transition={{ delay: i * 0.1, duration: 1.5, type: 'spring', bounce: 0.2 }}>
                                {logo}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </section>
    )
}
