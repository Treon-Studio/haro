'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@treonstudio/bungas-core/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@treonstudio/bungas-core/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@treonstudio/bungas-core/ui/select'
import { Checkbox } from '@treonstudio/bungas-core/ui/checkbox'
import { UserLinear, PhoneLinear, Buildings2Linear, HeartLinear, GlobalLinear, RefreshCircleLinear, CheckCircleLinear, DangerTriangleLinear, ArrowRightLinear, ClipboardListLinear } from 'solar-icon-set';

export function ProfileCompleter() {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [ageRange, setAgeRange] = useState<'18-24' | '25-34' | '35-44' | '45-54' | '55+' | ''>('')
  const [department, setDepartment] = useState('')
  const [gender, setGender] = useState('')
  const [pronouns, setPronouns] = useState('')
  const [language, setLanguage] = useState<'id' | 'en'>('id')
  const [notificationOptIn, setNotificationOptIn] = useState(true)

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Load existing profile if any
  useEffect(() => {
    fetch('/api/auth/profile')
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.data) {
          setFullName(result.data.full_name || '')
          setPhone(result.data.phone || '')
          setAgeRange(result.data.age_range || '')
          setDepartment(result.data.department || '')
          setGender(result.data.gender || '')
          setPronouns(result.data.pronouns || '')
          setLanguage(result.data.language || 'id')
          setNotificationOptIn(result.data.notification_opt_in ?? true)
        }
      })
      .catch((err) => console.error('Error fetching profile', err))
      .finally(() => setIsLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim() || null,
          phone: phone.trim() || null,
          ageRange: ageRange || null,
          department: department.trim() || null,
          gender: gender.trim() || null,
          pronouns: pronouns.trim() || null,
          language,
          notificationOptIn,
          onboardingCompleted: true, // sets onboarding_completed_at
        }),
      })

      const result = await res.json()
      if (result.success) {
        setSuccess(true)
        // Smoothly redirect to onboarding orientation after 1s
        setTimeout(() => {
          window.location.href = '/onboarding/orientation'
        }, 1000)
      } else {
        setErrorMsg(result.error?.message || 'Gagal menyimpan profil')
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto min-h-[400px]">
        <RefreshCircleLinear className="h-10 w-10 text-brand-primary animate-spin mb-4" />
        <h3 className="font-bold text-lg">Memuat Kuesioner Profil...</h3>
        <p className="text-xs text-text-secondary mt-1">Harap tunggu sementara kami menyiapkan profil Anda.</p>
      </div>
    )
  }

  return (
    <Card className="w-full max-w-lg mx-auto bg-surface-primary border-border-primary text-text-primary shadow-xl">
      <CardHeader className="space-y-2 border-b border-border-primary pb-6">
        <CardTitle className="text-2xl font-extrabold flex items-center gap-2">
          <ClipboardListLinear className="h-6 w-6 text-brand-primary" />
          Lengkapi Profil Anda
        </CardTitle>
        <CardDescription className="text-text-secondary text-xs sm:text-sm">
          Bantu kami memetakan dan menyesuaikan kapabilitas rekomendasi mental wellness bot AI demi kebaikan diri Anda.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Notifications */}
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-xs text-green-500 font-semibold">
              <CheckCircleLinear className="h-5 w-5 shrink-0" />
              <span>Profil berhasil disimpan! Mengarahkan ke halaman orientasi...</span>
            </div>
          )}
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-500">
              <DangerTriangleLinear className="h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullname" className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <UserLinear className="h-3.5 w-3.5 text-brand-primary" /> Nama Lengkap
            </Label>
            <Input
              id="fullname"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              className="border-border-primary bg-transparent text-text-primary placeholder:text-text-secondary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* PhoneLinear */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                <PhoneLinear className="h-3.5 w-3.5 text-brand-primary" /> Nomor Telepon (Opsional)
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+6281234567"
                className="border-border-primary bg-transparent text-text-primary placeholder:text-text-secondary"
              />
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department" className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                <Buildings2Linear className="h-3.5 w-3.5 text-brand-primary" /> Departemen / Divisi
              </Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Engineering"
                className="border-border-primary bg-transparent text-text-primary placeholder:text-text-secondary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Age Range */}
            <div className="space-y-2">
              <Label htmlFor="age" className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                Rentang Usia
              </Label>
              <Select value={ageRange} onValueChange={(val: any) => setAgeRange(val)}>
                <SelectTrigger className="border-border-primary bg-transparent text-text-primary">
                  <SelectValue placeholder="Pilih Usia" />
                </SelectTrigger>
                <SelectContent className="bg-surface-primary text-text-primary border-border-primary">
                  <SelectItem value="18-24">18-24 tahun</SelectItem>
                  <SelectItem value="25-34">25-34 tahun</SelectItem>
                  <SelectItem value="35-44">35-44 tahun</SelectItem>
                  <SelectItem value="45-54">45-54 tahun</SelectItem>
                  <SelectItem value="55+">55+ tahun</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Default Language */}
            <div className="space-y-2">
              <Label htmlFor="lang" className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                <GlobalLinear className="h-3.5 w-3.5 text-brand-primary" /> Bahasa Bot Utama
              </Label>
              <Select value={language} onValueChange={(val: any) => setLanguage(val)}>
                <SelectTrigger className="border-border-primary bg-transparent text-text-primary">
                  <SelectValue placeholder="Bahasa" />
                </SelectTrigger>
                <SelectContent className="bg-surface-primary text-text-primary border-border-primary">
                  <SelectItem value="id">Bahasa Indonesia</SelectItem>
                  <SelectItem value="en">English (US/UK)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Gender */}
            <div className="space-y-2">
              <Label htmlFor="gender" className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                Gender (Opsional)
              </Label>
              <Input
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                placeholder="Pria, Wanita, atau kosongkan"
                className="border-border-primary bg-transparent text-text-primary placeholder:text-text-secondary"
              />
            </div>

            {/* Pronouns */}
            <div className="space-y-2">
              <Label htmlFor="pronouns" className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                Kata Ganti (Opsional)
              </Label>
              <Input
                id="pronouns"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
                placeholder="e.g. He/Him, She/Her"
                className="border-border-primary bg-transparent text-text-primary placeholder:text-text-secondary"
              />
            </div>
          </div>

          {/* Notifications Opt-In */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-surface-secondary/50 border border-border-primary/50 text-xs">
            <Checkbox
              id="optin"
              checked={notificationOptIn}
              onCheckedChange={(checked) => setNotificationOptIn(!!checked)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label htmlFor="optin" className="font-bold cursor-pointer">Langganan Notifikasi Email</Label>
              <p className="text-text-secondary">Terima newsletter berkala, laporan analytics aggregate tim, dan tips meditasi harian.</p>
            </div>
          </div>

          {/* Submit Button */}
          <Button type="submit" disabled={isSubmitting} className="w-full bg-brand-primary text-white hover:bg-brand-secondary h-11 text-sm font-bold flex items-center justify-center gap-1.5">
            {isSubmitting ? (
              <>
                <RefreshCircleLinear className="h-4 w-4 animate-spin" />
                Menyimpan Profil...
              </>
            ) : (
              <>
                Lanjut ke Orientasi
                <ArrowRightLinear className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
