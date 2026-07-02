'use client';
import React from 'react';
import { ShieldWarningOutline, CardOutline, CloseCircleOutline } from 'solar-icon-set';

export type AuthErrorType = 'quota_exceeded' | 'forbidden' | null;

interface AuthErrorDialogProps {
  errorType: AuthErrorType;
  onClose: () => void;
}

export default function AuthErrorDialog({ errorType, onClose }: AuthErrorDialogProps) {
  if (!errorType) return null;

  const isQuota = errorType === 'quota_exceeded';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#1e1e1e',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          fontFamily: "'Inter', sans-serif",
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.05)',
            color: '#a0a0b0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = '#a0a0b0';
          }}
        >
          <CloseCircleOutline className="h-5 w-5" />
        </button>

        {/* Header / Icon */}
        <div
          style={{
            padding: '32px 24px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: isQuota ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isQuota ? '#ef4444' : '#f59e0b',
              marginBottom: '20px',
            }}
          >
            {isQuota ? <CardOutline className="h-7 w-7" /> : <ShieldWarningOutline className="h-7 w-7" />}
          </div>

          <h3
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#ececec',
              margin: 0,
              lineHeight: '1.4',
            }}
          >
            {isQuota ? 'Kuota Perusahaan Habis' : 'Akses Ditolak'}
          </h3>

          <p
            style={{
              fontSize: '14px',
              color: '#9ca3af',
              lineHeight: '1.6',
              margin: '12px 0 0',
              textAlign: 'center',
            }}
          >
            {isQuota
              ? 'Sesi kuota obrolan perusahaan Anda untuk bulan ini telah habis. Silakan hubungi HR Admin Anda untuk mengupgrade paket layanan Anda.'
              : 'Anda tidak terdaftar sebagai anggota aktif di organisasi ini. Silakan hubungi Administrator perusahaan Anda untuk mengaktifkan keanggotaan Anda.'}
          </p>
        </div>

        {/* Footer / Action */}
        <div
          style={{
            padding: '16px 24px 24px',
            display: 'flex',
            justifyContent: 'center',
            background: '#181818',
            borderTop: '1px solid rgba(255, 255, 255, 0.04)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: isQuota ? '#ef4444' : '#f59e0b',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            {isQuota ? 'Tutup' : 'Oke, Dimengerti'}
          </button>
        </div>
      </div>
    </div>
  );
}
