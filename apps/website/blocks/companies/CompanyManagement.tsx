'use client'

import { useState, useEffect, useId, useRef } from 'react'
import { cn } from '@treonstudio/bungas-core/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@treonstudio/bungas-core/ui/label'
import { Badge } from '@treonstudio/bungas-core/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@treonstudio/bungas-core/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@treonstudio/bungas-core/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@treonstudio/bungas-core/ui/select'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@treonstudio/bungas-core/ui/dropdown-menu'
import { Buildings2Linear, UsersGroupTwoRoundedLinear, SettingsLinear, AddCircleLinear, ShieldMinimalisticLinear, TrashBinTrashLinear, UserCheckLinear, UserBlockLinear, LetterLinear, DangerTriangleLinear, RefreshCircleLinear, CheckCircleLinear, MenuDotsLinear, ArrowRightLinear, ShieldCheckLinear, CardLinear, CrownLinear } from 'solar-icon-set';

type TCompany = {
  id: string
  name: string
  created_at: string
}

type TMembership = {
  id: string
  company_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  status: 'active' | 'invited' | 'suspended'
  created_at: string
}

export function CompanyManagement() {
  const [companies, setCompanies] = useState<TCompany[]>([])
  const [selectedCompany, setSelectedCompany] = useState<TCompany | null>(null)
  const [members, setMembers] = useState<TMembership[]>([])
  const [activeTab, setActiveTab] = useState<'members' | 'settings'>('members')

  // Loadings
  const [isCompaniesLoading, setIsCompaniesLoading] = useState(true)
  const [isMembersLoading, setIsMembersLoading] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)

  // Modals / Inputs
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newCompanyName, setNewCompanyCompanyName] = useState('')
  
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'owner' | 'admin' | 'member'>('member')

  const [editCompanyName, setEditCompanyName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // B2B Bulk Invitation states
  const [inviteTab, setInviteTab] = useState<'single' | 'bulk'>('single')
  const [bulkCsvText, setBulkCsvText] = useState('')
  const [bulkPreview, setBulkPreview] = useState<{
    total_count: number
    preview_rows: { email: string; role: string; valid: boolean; error?: string }[]
    anomalies_count: number
  } | null>(null)
  const [isBulkLoading, setIsBulkLoading] = useState(false)

  // B2B Corporate Branding states
  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#9B5B3E')
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [defaultLanguage, setDefaultLanguage] = useState<'id' | 'en'>('id')

  // Fetch Branding
  const fetchBranding = async (companyId: string) => {
    try {
      const res = await fetch(`/api/companies/${companyId}/branding`)
      const result = await res.json()
      if (result.success && result.data) {
        setLogoUrl(result.data.logo_url || '')
        setPrimaryColor(result.data.primary_color || '#9B5B3E')
        setWelcomeMessage(result.data.welcome_message || '')
        setDefaultLanguage(result.data.default_language || 'id')
      }
    } catch (err) {
      console.error('Error fetching branding', err)
    }
  }

  // Fetch Companies
  const fetchCompanies = async () => {
    setIsCompaniesLoading(true)
    try {
      const res = await fetch('/api/companies')
      const result = await res.json()
      if (result.success && result.data) {
        setCompanies(result.data)
        if (result.data.length > 0) {
          // Default to first company if none selected
          if (!selectedCompany) {
            setSelectedCompany(result.data[0])
            setEditCompanyName(result.data[0].name)
          } else {
            const found = result.data.find((c: TCompany) => c.id === selectedCompany.id)
            if (found) setSelectedCompany(found)
          }
        } else {
          setSelectedCompany(null)
        }
      }
    } catch (err) {
      console.error('Error fetching companies', err)
    } finally {
      setIsCompaniesLoading(false)
    }
  }

  // Fetch Members
  const fetchMembers = async (companyId: string) => {
    setIsMembersLoading(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/members`)
      const result = await res.json()
      if (result.success && result.data) {
        setMembers(result.data)
      }
    } catch (err) {
      console.error('Error fetching members', err)
    } finally {
      setIsMembersLoading(false)
    }
  }

  useEffect(() => {
    fetchCompanies()
  }, [])

  useEffect(() => {
    if (selectedCompany) {
      fetchMembers(selectedCompany.id)
      fetchBranding(selectedCompany.id)
      setEditCompanyName(selectedCompany.name)
    } else {
      setMembers([])
    }
    setErrorMessage(null)
    setSuccessMessage(null)
  }, [selectedCompany])

  // Create Company
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCompanyName.trim() || isActionLoading) return

    setIsActionLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCompanyName.trim() }),
      })
      const result = await res.json()
      if (result.success && result.data) {
        setNewCompanyCompanyName('')
        setIsCreateOpen(false)
        setSuccessMessage(`Berhasil membuat perusahaan "${result.data.name}"`)
        
        // Refresh and set active
        const updatedRes = await fetch('/api/companies')
        const updatedResult = await updatedRes.json()
        if (updatedResult.success && updatedResult.data) {
          setCompanies(updatedResult.data)
          const newComp = updatedResult.data.find((c: TCompany) => c.name === result.data.name)
          if (newComp) setSelectedCompany(newComp)
        }
      } else {
        setErrorMessage(result.error?.message || 'Gagal membuat perusahaan')
      }
    } catch (err) {
      setErrorMessage('Terjadi kesalahan jaringan')
    } finally {
      setIsActionLoading(false)
    }
  }

  // Update Company SettingsLinear
  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCompany || !editCompanyName.trim() || isActionLoading) return

    setIsActionLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const res = await fetch(`/api/companies/${selectedCompany.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editCompanyName.trim() }),
      })
      const result = await res.json()
      if (result.success && result.data) {
        setSuccessMessage('Nama perusahaan berhasil diperbarui')
        fetchCompanies()
      } else {
        setErrorMessage(result.error?.message || 'Gagal memperbarui nama perusahaan')
      }
    } catch (err) {
      setErrorMessage('Terjadi kesalahan jaringan')
    } finally {
      setIsActionLoading(false)
    }
  }

  // Update B2B Corporate Branding
  const handleUpdateBranding = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCompany || isActionLoading) return

    setIsActionLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const res = await fetch(`/api/companies/${selectedCompany.id}/branding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoUrl: logoUrl || null,
          primaryColor,
          welcomeMessage: welcomeMessage || null,
          defaultLanguage,
        }),
      })
      const result = await res.json()
      if (result.success && result.data) {
        setSuccessMessage('Setelan branding berhasil disimpan!')
        // Inject primary color CSS variable dynamically
        document.documentElement.style.setProperty("--primary", result.data.primary_color)
      } else {
        setErrorMessage(result.error?.message || 'Gagal memperbarui branding')
      }
    } catch (err) {
      setErrorMessage('Terjadi kesalahan jaringan')
    } finally {
      setIsActionLoading(false)
    }
  }

  // Invite Member
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCompany || !inviteEmail.trim() || isActionLoading) return

    setIsActionLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/companies/${selectedCompany.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: inviteEmail.trim(), // In real app, resolved to userId from email
          role: inviteRole,
        }),
      })
      const result = await res.json()
        if (result.success && result.data) {
          setInviteEmail('')
          setIsInviteOpen(false)
          setSuccessMessage('Berhasil mengirimkan undangan ke anggota baru')
          fetchMembers(selectedCompany.id)
        } else {
          setErrorMessage(result.error?.message || 'Gagal menambahkan anggota')
        }
      } catch (err) {
        setErrorMessage('Terjadi kesalahan jaringan')
      } finally {
        setIsActionLoading(false)
      }
    }

  // Preview CSV Bulk uploads (dry-run)
  const handlePreviewBulk = async () => {
    if (!selectedCompany || !bulkCsvText.trim() || isBulkLoading) return

    setIsBulkLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/companies/${selectedCompany.id}/invitations/bulk-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: bulkCsvText }),
      })
      const result = await res.json()
      if (result.success && result.data) {
        setBulkPreview(result.data)
      } else {
        setErrorMessage(result.error?.message || 'Gagal memproses pratinjau CSV')
      }
    } catch {
      setErrorMessage('Terjadi kesalahan jaringan')
    } finally {
      setIsBulkLoading(false)
    }
  }

  // Process Bulk invitations (sequential uploader)
  const handleBulkInvite = async () => {
    if (!selectedCompany || !bulkCsvText.trim() || isActionLoading) return

    setIsActionLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const res = await fetch(`/api/companies/${selectedCompany.id}/invitations/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: bulkCsvText }),
      })
      const result = await res.json()
      if (result.success && result.data) {
        const successes = result.data.filter((r: any) => r.status === 'success')
        const failures = result.data.filter((r: any) => r.status === 'error')

        setSuccessMessage(`Proses kirim undangan selesai. Sukses: ${successes.length}, Gagal: ${failures.length}`)
        setBulkCsvText('')
        setBulkPreview(null)
        setIsInviteOpen(false)
        fetchMembers(selectedCompany.id)
      } else {
        setErrorMessage(result.error?.message || 'Gagal memproses pengiriman masal')
      }
    } catch {
      setErrorMessage('Terjadi kesalahan jaringan')
    } finally {
      setIsActionLoading(false)
    }
  }

  // Update Member (Role / Status)
  const handleUpdateMember = async (membershipId: string, role: 'owner' | 'admin' | 'member', status: 'active' | 'invited' | 'suspended') => {
    if (!selectedCompany || isActionLoading) return

    setIsActionLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/companies/${selectedCompany.id}/members/${membershipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, status }),
      })
      const result = await res.json()
      if (result.success) {
        setSuccessMessage('Status anggota berhasil diperbarui')
        fetchMembers(selectedCompany.id)
      } else {
        setErrorMessage(result.error?.message || 'Gagal memperbarui anggota')
      }
    } catch (err) {
      setErrorMessage('Terjadi kesalahan jaringan')
    } finally {
      setIsActionLoading(false)
    }
  }

  // Remove Member
  const handleRemoveMember = async (membershipId: string) => {
    if (!selectedCompany || isActionLoading) return

    setIsActionLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/companies/${selectedCompany.id}/members/${membershipId}`, {
        method: 'DELETE',
      })
      const result = await res.json()
      if (result.success) {
        setSuccessMessage('Anggota berhasil dihapus dari perusahaan')
        fetchMembers(selectedCompany.id)
      } else {
        setErrorMessage(result.error?.message || 'Gagal menghapus anggota')
      }
    } catch (err) {
      setErrorMessage('Terjadi kesalahan jaringan')
    } finally {
      setIsActionLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      {/* Header & Company Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">B2B Management Panel</h1>
          <p className="text-sm text-text-secondary">Kelola organisasi, keanggotaan tim, kebijakan, dan langganan Anda.</p>
        </div>

        {/* Company Dropdown / Create Trigger */}
        <div className="flex items-center gap-2">
          {isCompaniesLoading ? (
            <div className="h-10 w-[200px] animate-pulse rounded bg-surface-secondary" />
          ) : companies.length > 0 ? (
            <Select
              value={selectedCompany?.id}
              onValueChange={(id) => {
                const found = companies.find((c) => c.id === id)
                if (found) setSelectedCompany(found)
              }}
            >
              <SelectTrigger className="w-[200px] bg-surface-secondary text-text-primary border-border-primary">
                <SelectValue placeholder="Pilih Perusahaan" />
              </SelectTrigger>
              <SelectContent className="bg-surface-primary text-text-primary border-border-primary">
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-text-secondary">Belum ada organisasi.</p>
          )}

          {/* Create Company Dialog */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-1 bg-brand-primary text-white hover:bg-brand-secondary">
                <AddCircleLinear className="h-4 w-4" />
                <span className="hidden sm:inline">Tambah Organisasi</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-surface-primary text-text-primary border-border-primary">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Buildings2Linear className="h-5 w-5 text-brand-primary" />
                  Buat Organisasi Baru
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateCompany} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="org-name" className="text-sm font-medium">Nama Organisasi</Label>
                  <Input
                    id="org-name"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyCompanyName(e.target.value)}
                    placeholder="e.g. PT Maju Bersama"
                    required
                    className="border-border-primary text-text-primary placeholder:text-text-secondary bg-transparent focus-visible:ring-2 focus-visible:ring-brand-primary"
                  />
                </div>
                <DialogFooter className="pt-2">
                  <Button type="submit" disabled={!newCompanyName.trim() || isActionLoading}>
                    {isActionLoading ? <RefreshCircleLinear className="mr-1 h-4 w-4 animate-spin" /> : 'Buat Organisasi'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* InfoCircleLinear Messages */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-500">
          <CheckCircleLinear className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-500">
          <DangerTriangleLinear className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {selectedCompany ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {/* Sidebar Navigation */}
          <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0 border-b border-border-primary md:border-b-0">
            <button
              onClick={() => setActiveTab('members')}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors w-full whitespace-nowrap",
                activeTab === 'members'
                  ? "bg-brand-primary/10 text-brand-primary"
                  : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
              )}
            >
              <UsersGroupTwoRoundedLinear className="h-4 w-4" />
              Anggota Tim ({members.length})
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors w-full whitespace-nowrap",
                activeTab === 'settings'
                  ? "bg-brand-primary/10 text-brand-primary"
                  : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
              )}
            >
              <SettingsLinear className="h-4 w-4" />
              Pengaturan Organisasi
            </button>
          </div>

          {/* Main Area */}
          <div className="md:col-span-3 space-y-6">
            {activeTab === 'members' && (
              <Card className="bg-surface-primary border-border-primary text-text-primary">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <UsersGroupTwoRoundedLinear className="h-5 w-5 text-brand-primary" />
                      Anggota Tim
                    </CardTitle>
                    <CardDescription className="text-text-secondary">Kelola keanggotaan dan izin akses untuk {selectedCompany.name}.</CardDescription>
                  </div>

                  {/* Invite Member Dialog */}
                  <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-1 bg-brand-primary text-white hover:bg-brand-secondary">
                        <AddCircleLinear className="h-4 w-4" />
                        Tambah Anggota
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-surface-primary text-text-primary border-border-primary">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <LetterLinear className="h-5 w-5 text-brand-primary" />
                          Undang Anggota Tim
                        </DialogTitle>
                      </DialogHeader>
                      {/* Tab Selectors for Invite Modes */}
                      <div className="flex border-b border-border-primary mb-4">
                        <button
                          type="button"
                          onClick={() => { setInviteTab('single'); setErrorMessage(null); }}
                          className={cn(
                            "flex-1 py-2 text-xs font-semibold border-b-2 text-center transition-all bg-transparent",
                            inviteTab === 'single'
                              ? "border-brand-primary text-brand-primary"
                              : "border-transparent text-text-secondary hover:text-text-primary"
                          )}
                        >
                          Undang Tunggal
                        </button>
                        <button
                          type="button"
                          onClick={() => { setInviteTab('bulk'); setErrorMessage(null); }}
                          className={cn(
                            "flex-1 py-2 text-xs font-semibold border-b-2 text-center transition-all bg-transparent",
                            inviteTab === 'bulk'
                              ? "border-brand-primary text-brand-primary"
                              : "border-transparent text-text-secondary hover:text-text-primary"
                          )}
                        >
                          Undang Masal (CSV)
                        </button>
                      </div>

                      {inviteTab === 'single' ? (
                        <form onSubmit={handleInviteMember} className="space-y-4 py-2">
                          <div className="space-y-2">
                            <Label htmlFor="member-email" className="text-sm font-medium">UserLinear ID / Email</Label>
                            <Input
                              id="member-email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="e.g. user-uuid-or-email"
                              required
                              className="border-border-primary text-text-primary placeholder:text-text-secondary bg-transparent focus-visible:ring-2 focus-visible:ring-brand-primary"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="member-role" className="text-sm font-medium">Peran Akses</Label>
                            <Select
                              value={inviteRole}
                              onValueChange={(val) => setInviteRole(val as 'owner' | 'admin' | 'member')}
                            >
                              <SelectTrigger className="bg-transparent border-border-primary text-text-primary">
                                <SelectValue placeholder="Pilih Peran" />
                              </SelectTrigger>
                              <SelectContent className="bg-surface-primary text-text-primary border-border-primary">
                                <SelectItem value="member">Member (Akses Chat standar)</SelectItem>
                                <SelectItem value="admin">Admin (Bisa mengelola anggota & setelan)</SelectItem>
                                <SelectItem value="owner">Owner (Hak penuh, setelan penagihan)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <DialogFooter className="pt-2">
                            <Button type="submit" disabled={!inviteEmail.trim() || isActionLoading}>
                              {isActionLoading ? <RefreshCircleLinear className="mr-1 h-4 w-4 animate-spin" /> : 'Kirim Undangan'}
                            </Button>
                          </DialogFooter>
                        </form>
                      ) : (
                        <div className="space-y-4 py-2">
                          <div className="space-y-2">
                            <Label htmlFor="bulk-csv" className="text-sm font-medium">Data CSV Anggota</Label>
                            <Textarea
                              id="bulk-csv"
                              value={bulkCsvText}
                              onChange={(e) => setBulkCsvText(e.target.value)}
                              placeholder="email,role&#10;user1@domain.com,member&#10;user2@domain.com,admin"
                              className="border-border-primary text-text-primary bg-transparent font-mono text-xs min-h-[120px]"
                            />
                            <p className="text-[10px] text-text-secondary">Baris pertama adalah header. Peran yang valid: member, admin, owner (default member).</p>
                          </div>

                          {/* Bulk Preview Analysis */}
                          {bulkPreview && (
                            <div className="space-y-2 p-3 rounded-lg border border-border-primary bg-surface-secondary/30 text-xs">
                              <div className="font-bold flex justify-between">
                                <span>Hasil Parsing CSV:</span>
                                <Badge className={cn("border-none", bulkPreview.anomalies_count > 0 ? "bg-amber-500/10 text-amber-500" : "bg-green-500/10 text-green-500")}>
                                  {bulkPreview.anomalies_count} Anomali
                                </Badge>
                              </div>
                              <div className="text-text-secondary">Total terdeteksi: <span className="font-semibold text-text-primary">{bulkPreview.total_count} baris</span></div>
                              
                              <div className="space-y-1 mt-2">
                                <div className="text-[10px] uppercase font-bold text-text-secondary">Pratinjau 5 Baris Pertama:</div>
                                {bulkPreview.preview_rows.slice(0, 5).map((row, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-[11px]">
                                    <span className="truncate max-w-[200px] font-mono">{row.email} ({row.role})</span>
                                    <Badge className={cn("border-none text-[9px]", row.valid ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                                      {row.valid ? 'Valid' : 'Gagal'}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handlePreviewBulk}
                              disabled={!bulkCsvText.trim() || isBulkLoading}
                              className="w-full sm:w-auto"
                            >
                              {isBulkLoading ? <RefreshCircleLinear className="mr-1 h-4 w-4 animate-spin" /> : 'Pratinjau (Dry-run)'}
                            </Button>
                            <Button
                              type="button"
                              onClick={handleBulkInvite}
                              disabled={!bulkCsvText.trim() || isActionLoading || (bulkPreview && bulkPreview.total_count === 0)}
                              className="w-full sm:w-auto"
                            >
                              {isActionLoading ? <RefreshCircleLinear className="mr-1 h-4 w-4 animate-spin" /> : 'Kirim Undangan Massal'}
                            </Button>
                          </DialogFooter>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent className="p-0 sm:p-6">
                  {isMembersLoading ? (
                    <div className="space-y-4 px-6 py-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-secondary" />
                      ))}
                    </div>
                  ) : members.length > 0 ? (
                    <div className="divide-y divide-border-primary overflow-hidden sm:rounded-lg border border-border-primary sm:border-none">
                      {members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-4 hover:bg-surface-secondary/50">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-full text-white",
                              member.role === 'owner' ? "bg-amber-500" : member.role === 'admin' ? "bg-brand-primary" : "bg-blue-500"
                            )}>
                              {member.role === 'owner' ? <CrownLinear className="h-4 w-4" /> : member.role === 'admin' ? <ShieldCheckLinear className="h-4 w-4" /> : <UsersGroupTwoRoundedLinear className="h-4 w-4" />}
                            </div>
                            <div>
                              <div className="font-semibold text-text-primary flex items-center gap-2">
                                {member.user_id}
                                {member.role === 'owner' && <Badge className="bg-amber-500/10 text-amber-500 border-none">Owner</Badge>}
                                {member.role === 'admin' && <Badge className="bg-brand-primary/10 text-brand-primary border-none">Admin</Badge>}
                              </div>
                              <div className="text-xs text-text-secondary">Bergabung pada {new Date(member.created_at).toLocaleDateString()}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge className={cn(
                              "border-none",
                              member.status === 'active' ? "bg-green-500/10 text-green-500" : member.status === 'invited' ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"
                            )}>
                              {member.status === 'active' ? 'Aktif' : member.status === 'invited' ? 'Undangan' : 'Ditangguhkan'}
                            </Badge>

                            {/* Actions Dropdown */}
                            {member.role !== 'owner' && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MenuDotsLinear className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-surface-primary text-text-primary border-border-primary">
                                  {member.role !== 'admin' && (
                                    <DropdownMenuItem onClick={() => handleUpdateMember(member.id, 'admin', member.status)}>
                                      <ShieldCheckLinear className="mr-2 h-4 w-4 text-brand-primary" />
                                      Jadikan Admin
                                    </DropdownMenuItem>
                                  )}
                                  {member.role === 'admin' && (
                                    <DropdownMenuItem onClick={() => handleUpdateMember(member.id, 'member', member.status)}>
                                      <UsersGroupTwoRoundedLinear className="mr-2 h-4 w-4 text-text-secondary" />
                                      Ubah jadi Member
                                    </DropdownMenuItem>
                                  )}
                                  {member.status === 'active' && (
                                    <DropdownMenuItem onClick={() => handleUpdateMember(member.id, member.role, 'suspended')}>
                                      <UserBlockLinear className="mr-2 h-4 w-4 text-red-500" />
                                      Tangguhkan
                                    </DropdownMenuItem>
                                  )}
                                  {member.status === 'suspended' && (
                                    <DropdownMenuItem onClick={() => handleUpdateMember(member.id, member.role, 'active')}>
                                      <UserCheckLinear className="mr-2 h-4 w-4 text-green-500" />
                                      Aktifkan Kembali
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleRemoveMember(member.id)} className="text-red-500 focus:text-red-500">
                                    <TrashBinTrashLinear className="mr-2 h-4 w-4" />
                                    Keluarkan Anggota
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-text-secondary">Belum ada anggota tim.</div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                {/* General SettingsLinear */}
                <Card className="bg-surface-primary border-border-primary text-text-primary">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <Buildings2Linear className="h-5 w-5 text-brand-primary" />
                      Setelan Umum
                    </CardTitle>
                    <CardDescription className="text-text-secondary">Ubah profil dan konfigurasi organisasi.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleUpdateCompany} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-org-name" className="text-sm font-medium">Nama Organisasi</Label>
                        <Input
                          id="edit-org-name"
                          value={editCompanyName}
                          onChange={(e) => setEditCompanyName(e.target.value)}
                          placeholder="e.g. PT Maju Bersama"
                          required
                          className="border-border-primary text-text-primary bg-transparent focus-visible:ring-2 focus-visible:ring-brand-primary"
                        />
                      </div>
                      <Button type="submit" disabled={!editCompanyName.trim() || isActionLoading}>
                        {isActionLoading ? <RefreshCircleLinear className="mr-1 h-4 w-4 animate-spin" /> : 'Simpan Perubahan'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* B2B Corporate Branding SettingsLinear */}
                <Card className="bg-surface-primary border-border-primary text-text-primary">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <SettingsLinear className="h-5 w-5 text-brand-primary" />
                      Branding & Identitas Korporat
                    </CardTitle>
                    <CardDescription className="text-text-secondary">Sesuaikan tema, logo, bahasa, dan pesan sambutan bot AI khusus organisasi Anda.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleUpdateBranding} className="space-y-4">
                      {/* Logo URL */}
                      <div className="space-y-2">
                        <Label htmlFor="logo-url" className="text-sm font-medium">URL Logo Perusahaan</Label>
                        <Input
                          id="logo-url"
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          placeholder="e.g. https://yourcompany.com/logo.png"
                          className="border-border-primary text-text-primary bg-transparent"
                        />
                      </div>

                      {/* Primary Color & Swatch Preview */}
                      <div className="space-y-2">
                        <Label htmlFor="theme-color" className="text-sm font-medium">Tema Warna Utama (HEX)</Label>
                        <div className="flex gap-3 items-center">
                          <div
                            className="h-10 w-10 rounded-lg border border-border-primary shadow-sm shrink-0 transition-all"
                            style={{ backgroundColor: primaryColor }}
                          />
                          <Input
                            id="theme-color"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            placeholder="#9B5B3E"
                            pattern="^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
                            required
                            className="border-border-primary text-text-primary bg-transparent font-mono"
                          />
                        </div>
                        <p className="text-[10px] text-text-secondary">Warna utama untuk melabur tombol dan penunjuk status aktif AI.</p>
                      </div>

                      {/* Welcome Message */}
                      <div className="space-y-2">
                        <Label htmlFor="welcome-msg" className="text-sm font-medium">Pesan Sambutan Bot AI</Label>
                        <Textarea
                          id="welcome-msg"
                          value={welcomeMessage}
                          onChange={(e) => setWelcomeMessage(e.target.value)}
                          placeholder="Selamat datang di ruang aman mental wellness tim Anda..."
                          className="border-border-primary text-text-primary bg-transparent min-h-[80px]"
                        />
                      </div>

                      {/* Default Language */}
                      <div className="space-y-2">
                        <Label htmlFor="brand-lang" className="text-sm font-medium">Bahasa Default Bot</Label>
                        <Select
                          value={defaultLanguage}
                          onValueChange={(val) => setDefaultLanguage(val as 'id' | 'en')}
                        >
                          <SelectTrigger className="border-border-primary text-text-primary bg-transparent">
                            <SelectValue placeholder="Pilih Bahasa" />
                          </SelectTrigger>
                          <SelectContent className="bg-surface-primary text-text-primary border-border-primary">
                            <SelectItem value="id">Bahasa Indonesia</SelectItem>
                            <SelectItem value="en">English (US/UK)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button type="submit" disabled={isActionLoading}>
                        {isActionLoading ? <RefreshCircleLinear className="mr-1 h-4 w-4 animate-spin" /> : 'Simpan Setelan Branding'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Billing / Subscription */}
                <Card className="bg-surface-primary border-border-primary text-text-primary">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <CardLinear className="h-5 w-5 text-brand-primary" />
                      Paket Langganan & Penagihan
                    </CardTitle>
                    <CardDescription className="text-text-secondary">Konfigurasi limit, kapasitas model, dan invoice.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-brand-primary/20 bg-brand-primary/5 p-4">
                      <div className="space-y-1">
                        <div className="text-xs uppercase tracking-wider font-extrabold text-brand-primary">Paket Aktif Anda</div>
                        <div className="text-lg font-bold text-text-primary flex items-center gap-1">
                          Haro Business Pro
                          <Badge className="bg-brand-primary text-white hover:bg-brand-secondary border-none">Pro</Badge>
                        </div>
                        <div className="text-xs text-text-secondary">Aktif hingga 24 Juni 2027 (Penagihan Tahunan)</div>
                      </div>
                      <Button variant="outline" className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white">
                        Kelola Billing
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border border-border-primary p-4 space-y-1 bg-surface-secondary/50">
                        <div className="text-xs text-text-secondary uppercase">Kuota Tokens B2B</div>
                        <div className="text-2xl font-bold">15M / 50M</div>
                        <div className="text-[10px] text-text-secondary">Digunakan bulan ini</div>
                      </div>
                      <div className="rounded-lg border border-border-primary p-4 space-y-1 bg-surface-secondary/50">
                        <div className="text-xs text-text-secondary uppercase">Maksimal Anggota</div>
                        <div className="text-2xl font-bold">{members.length} / 50</div>
                        <div className="text-[10px] text-text-secondary">Kapasitas kursi tim</div>
                      </div>
                      <div className="rounded-lg border border-border-primary p-4 space-y-1 bg-surface-secondary/50">
                        <div className="text-xs text-text-secondary uppercase">Custom Agent AI</div>
                        <div className="text-2xl font-bold">8 / 25</div>
                        <div className="text-[10px] text-text-secondary">Agent khusus organisasi</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Danger Zone */}
                <Card className="border-red-500/20 bg-red-500/5 text-text-primary">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold text-red-500 flex items-center gap-2">
                      <DangerTriangleLinear className="h-5 w-5" />
                      Danger Zone
                    </CardTitle>
                    <CardDescription className="text-red-500/70">Tindakan berikut bersifat permanen dan tidak dapat dibatalkan.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="font-bold">Deaktifkan Organisasi</div>
                        <p className="text-xs text-text-secondary max-w-lg">Ini akan menonaktifkan seluruh akses chat untuk semua anggota dan mengarsipkan seluruh data AI Chat.</p>
                      </div>
                      <Button className="bg-red-600 hover:bg-red-700 text-white shrink-0 border-none">
                        Deaktifkan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-primary p-12 text-center bg-surface-secondary/20">
          <Buildings2Linear className="h-12 w-12 text-text-secondary mb-4 animate-bounce" />
          <h2 className="text-xl font-bold text-text-primary mb-1">Mulai Dengan Membuat Organisasi</h2>
          <p className="text-sm text-text-secondary max-w-md mb-6">
            Anda belum bergabung dalam organisasi B2B mana pun. Buat organisasi pertama Anda untuk menikmati kapabilitas enterprise AI.
          </p>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-brand-primary text-white hover:bg-brand-secondary"
          >
            <AddCircleLinear className="mr-1 h-4 w-4" />
            Buat Organisasi Pertama
          </Button>
        </div>
      )}
    </div>
  )
}
