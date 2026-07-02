'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@treonstudio/bungas-core/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@treonstudio/bungas-core/ui/dialog'
import { ShieldCheckLinear, HeartLinear, ForbiddenCircleLinear, LockLinear, ArrowRightLinear, HelpLinear, DangerCircleLinear, CheckCircleLinear, UsersGroupTwoRoundedLinear } from 'solar-icon-set';

export function OrientationBlock() {
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  useEffect(() => {
    // Fetch active company name to personalize the privacy notice
    fetch('/api/companies')
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.data && result.data.length > 0) {
          setCompanyName(result.data[0].name)
        }
      })
      .catch((err) => console.error('Error fetching companies for orientation', err))
  }, [])

  const handleStart = () => {
    window.location.href = '/c'
  }

  return (
    <Card className="w-full max-w-2xl mx-auto bg-surface-primary border-border-primary text-text-primary shadow-2xl">
      <CardHeader className="space-y-3 text-center border-b border-border-primary pb-6">
        <div className="mx-auto h-12 w-12 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center">
          <ShieldCheckLinear className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-3xl font-extrabold tracking-tight">Selamat Datang di TenangAI</CardTitle>
          <CardDescription className="text-text-secondary text-sm">
            Sebelum memulai chat pertama Anda, mari pahami batasan dan komitmen privasi kami demi keamanan Anda.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* What we can do */}
          <div className="space-y-3 p-4 rounded-xl border border-border-primary bg-surface-secondary/20">
            <h3 className="font-bold flex items-center gap-2 text-green-500">
              <HeartLinear className="h-5 w-5 shrink-0" />
              Apa Yang Bisa Kami Lakukan
            </h3>
            <ul className="space-y-2 text-xs text-text-secondary list-disc pl-4 leading-relaxed">
              <li>Mendengar keluh kesah dan jurnal refleksi harian Anda secara interaktif 24/7.</li>
              <li>Membantu Anda memetakan emosi dan meregulasi tingkat stres harian.</li>
              <li>Merekomendasikan latihan pernapasan, meditasi terbimbing, dan konten wellness yang sesuai.</li>
            </ul>
          </div>

          {/* What we cannot do */}
          <div className="space-y-3 p-4 rounded-xl border border-border-primary bg-surface-secondary/20">
            <h3 className="font-bold flex items-center gap-2 text-red-500">
              <ForbiddenCircleLinear className="h-5 w-5 shrink-0" />
              Apa Yang Tidak Bisa Kami Lakukan
            </h3>
            <ul className="space-y-2 text-xs text-text-secondary list-disc pl-4 leading-relaxed">
              <li><strong className="text-text-primary">Bukan Terapi Medis</strong>: Bot AI kami tidak dapat memberikan diagnosis psikologis atau resep medis.</li>
              <li><strong className="text-text-primary">Bukan Saluran Krisis</strong>: Tenang tidak melayani pencegahan bunuh diri atau pertolongan krisis akut darurat.</li>
            </ul>
          </div>
        </div>

        {/* Confidentiality Notice */}
        <div className="flex items-start gap-3 p-4 rounded-xl border border-brand-primary/10 bg-brand-primary/5 text-xs leading-relaxed">
          <LockLinear className="h-5 w-5 shrink-0 text-brand-primary mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-extrabold text-brand-primary">Kerahasiaan Obrolan & Privasi 100% Terjamin</h4>
            <p className="text-text-secondary">
              Seluruh percakapan chat, refleksi jurnal, dan riwayat wellness Anda bersifat sepenuhnya privat. 
              {companyName ? (
                <> Perusahaan Anda (<strong className="text-text-primary font-bold">{companyName}</strong>) maupun HR sama sekali <strong className="text-text-primary font-bold">TIDAK MEMILIKI AKSES</strong> untuk membaca atau melihat obrolan personal Anda. </>
              ) : (
                " Pihak perusahaan langganan Anda sama sekali tidak memiliki akses ke obrolan Anda. "
              )}
              HR hanya menerima laporan analitik agregat dalam jumlah gabungan (misal: "X% karyawan mengalami stres bulan ini") untuk pemetaan benefit kantor tanpa mengidentifikasi identitas individu Anda.
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t border-border-primary p-6 flex flex-col sm:flex-row gap-3">
        {/* Mulai Chat */}
        <Button onClick={handleStart} className="w-full bg-brand-primary text-white hover:bg-brand-secondary h-11 text-sm font-bold flex items-center justify-center gap-1.5 order-first sm:order-last">
          Mulai Chat Sekarang
          <ArrowRightLinear className="h-4 w-4" />
        </Button>

        {/* Skip Onboarding Dialog */}
        <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="w-full text-text-secondary hover:bg-surface-secondary/50 h-11 text-sm">
              Lewati Onboarding
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-surface-primary text-text-primary border-border-primary">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-500">
                <DangerCircleLinear className="h-5 w-5 shrink-0" />
                Lewati Orientasi Penting?
              </DialogTitle>
            </DialogHeader>
            <div className="text-xs text-text-secondary space-y-2 py-2 leading-relaxed">
              <p>Membaca lembar orientasi sangat penting demi keselamatan dan ekspektasi hukum medis Anda.</p>
              <p className="font-semibold text-text-primary">Apakah Anda yakin ingin melewatkan penjelasan batasan AI ini?</p>
            </div>
            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsConfirmOpen(false)} className="w-full sm:w-auto">
                Kembali Baca
              </Button>
              <Button type="button" onClick={handleStart} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white border-none">
                Ya, Lewatkan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  )
}
