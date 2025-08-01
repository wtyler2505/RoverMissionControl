/**
 * Localization Provider for Feedback System
 * 
 * Provides multi-language support for all feedback messages with
 * fallback mechanisms and dynamic language switching.
 * 
 * @component
 * @version 1.0.0
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

// Types
export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'ar' | 'ru' | 'pt' | 'hi';

export interface LocalizedMessage {
  [key: string]: string;
}

export interface LocalizationContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, any>) => string;
  supportedLocales: LocaleInfo[];
  direction: 'ltr' | 'rtl';
}

export interface LocaleInfo {
  code: Locale;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  flag: string;
}

// Translation Messages
const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Emergency Stop
    'emergency.stop.activated': 'EMERGENCY STOP ACTIVATED',
    'emergency.stop.deactivated': 'Emergency Stop Cleared',
    'emergency.stop.confirm': 'Confirm Emergency Stop',
    'emergency.stop.reason': 'Reason: {{reason}}',
    'emergency.stop.autoStop': 'Auto-stop triggered: {{reason}}',
    'emergency.stop.hardwareFault': 'Hardware fault detected',
    'emergency.stop.connectionLost': 'Connection lost - Emergency stop activated',
    'emergency.stop.testMode': 'TEST MODE - No physical action',
    
    // Status Messages
    'status.normal': 'System Operating Normally',
    'status.warning': 'Warning Condition Detected',
    'status.error': 'Error Condition',
    'status.critical': 'Critical System Error',
    'status.emergency': 'EMERGENCY',
    
    // Connection Status
    'connection.excellent': 'Excellent Connection',
    'connection.good': 'Good Connection',
    'connection.fair': 'Fair Connection',
    'connection.poor': 'Poor Connection',
    'connection.disconnected': 'Disconnected',
    'connection.reconnecting': 'Reconnecting...',
    'connection.latency': 'Latency: {{ms}}ms',
    
    // Confirmations
    'confirm.title': 'Confirmation Required',
    'confirm.destructive': 'This action cannot be undone',
    'confirm.typeText': 'Type "{{text}}" to confirm',
    'confirm.holdButton': 'Hold button for {{seconds}} seconds',
    'confirm.enterPin': 'Enter your PIN',
    'confirm.biometric': 'Use biometric authentication',
    'confirm.twoFactor': 'Enter 2FA code',
    
    // Actions
    'action.confirm': 'Confirm',
    'action.cancel': 'Cancel',
    'action.acknowledge': 'Acknowledge',
    'action.dismiss': 'Dismiss',
    'action.retry': 'Retry',
    'action.details': 'View Details',
    'action.help': 'Get Help',
    'action.minimize': 'Minimize',
    'action.expand': 'Expand',
    'action.collapse': 'Collapse',
    
    // Feedback
    'feedback.success': 'Action completed successfully',
    'feedback.error': 'An error occurred',
    'feedback.warning': 'Please review this warning',
    'feedback.info': 'Information',
    'feedback.soundEnabled': 'Sound enabled',
    'feedback.soundDisabled': 'Sound disabled',
    'feedback.hapticEnabled': 'Haptic feedback enabled',
    'feedback.hapticDisabled': 'Haptic feedback disabled',
    
    // Time
    'time.seconds': '{{count}} seconds',
    'time.minutes': '{{count}} minutes',
    'time.hours': '{{count}} hours',
    'time.ago': '{{time}} ago',
    'time.remaining': '{{time}} remaining',
    
    // Accessibility
    'a11y.screenReaderAlert': 'Alert: {{message}}',
    'a11y.emergencyAlert': 'Emergency alert: {{message}}',
    'a11y.statusChange': 'Status changed to {{status}}',
    'a11y.actionRequired': 'Action required: {{action}}',
  },
  
  es: {
    // Emergency Stop
    'emergency.stop.activated': 'PARADA DE EMERGENCIA ACTIVADA',
    'emergency.stop.deactivated': 'Parada de Emergencia Desactivada',
    'emergency.stop.confirm': 'Confirmar Parada de Emergencia',
    'emergency.stop.reason': 'Razón: {{reason}}',
    'emergency.stop.autoStop': 'Parada automática activada: {{reason}}',
    'emergency.stop.hardwareFault': 'Fallo de hardware detectado',
    'emergency.stop.connectionLost': 'Conexión perdida - Parada de emergencia activada',
    'emergency.stop.testMode': 'MODO DE PRUEBA - Sin acción física',
    
    // Status Messages
    'status.normal': 'Sistema Operando Normalmente',
    'status.warning': 'Condición de Advertencia Detectada',
    'status.error': 'Condición de Error',
    'status.critical': 'Error Crítico del Sistema',
    'status.emergency': 'EMERGENCIA',
    
    // Connection Status
    'connection.excellent': 'Conexión Excelente',
    'connection.good': 'Buena Conexión',
    'connection.fair': 'Conexión Regular',
    'connection.poor': 'Conexión Deficiente',
    'connection.disconnected': 'Desconectado',
    'connection.reconnecting': 'Reconectando...',
    'connection.latency': 'Latencia: {{ms}}ms',
    
    // Confirmations
    'confirm.title': 'Confirmación Requerida',
    'confirm.destructive': 'Esta acción no se puede deshacer',
    'confirm.typeText': 'Escriba "{{text}}" para confirmar',
    'confirm.holdButton': 'Mantenga el botón por {{seconds}} segundos',
    'confirm.enterPin': 'Ingrese su PIN',
    'confirm.biometric': 'Use autenticación biométrica',
    'confirm.twoFactor': 'Ingrese código 2FA',
    
    // Actions
    'action.confirm': 'Confirmar',
    'action.cancel': 'Cancelar',
    'action.acknowledge': 'Reconocer',
    'action.dismiss': 'Descartar',
    'action.retry': 'Reintentar',
    'action.details': 'Ver Detalles',
    'action.help': 'Obtener Ayuda',
    'action.minimize': 'Minimizar',
    'action.expand': 'Expandir',
    'action.collapse': 'Colapsar',
    
    // Feedback
    'feedback.success': 'Acción completada exitosamente',
    'feedback.error': 'Ocurrió un error',
    'feedback.warning': 'Por favor revise esta advertencia',
    'feedback.info': 'Información',
    'feedback.soundEnabled': 'Sonido activado',
    'feedback.soundDisabled': 'Sonido desactivado',
    'feedback.hapticEnabled': 'Retroalimentación háptica activada',
    'feedback.hapticDisabled': 'Retroalimentación háptica desactivada',
    
    // Time
    'time.seconds': '{{count}} segundos',
    'time.minutes': '{{count}} minutos',
    'time.hours': '{{count}} horas',
    'time.ago': 'hace {{time}}',
    'time.remaining': '{{time}} restante',
    
    // Accessibility
    'a11y.screenReaderAlert': 'Alerta: {{message}}',
    'a11y.emergencyAlert': 'Alerta de emergencia: {{message}}',
    'a11y.statusChange': 'Estado cambiado a {{status}}',
    'a11y.actionRequired': 'Acción requerida: {{action}}',
  },
  
  fr: {
    // Emergency Stop
    'emergency.stop.activated': 'ARRÊT D\'URGENCE ACTIVÉ',
    'emergency.stop.deactivated': 'Arrêt d\'urgence désactivé',
    'emergency.stop.confirm': 'Confirmer l\'arrêt d\'urgence',
    'emergency.stop.reason': 'Raison: {{reason}}',
    'emergency.stop.autoStop': 'Arrêt automatique déclenché: {{reason}}',
    'emergency.stop.hardwareFault': 'Défaut matériel détecté',
    'emergency.stop.connectionLost': 'Connexion perdue - Arrêt d\'urgence activé',
    'emergency.stop.testMode': 'MODE TEST - Aucune action physique',
    
    // Status Messages
    'status.normal': 'Système fonctionne normalement',
    'status.warning': 'Condition d\'avertissement détectée',
    'status.error': 'Condition d\'erreur',
    'status.critical': 'Erreur système critique',
    'status.emergency': 'URGENCE',
    
    // Actions
    'action.confirm': 'Confirmer',
    'action.cancel': 'Annuler',
    'action.acknowledge': 'Acquitter',
    'action.dismiss': 'Rejeter',
    'action.retry': 'Réessayer',
    'action.details': 'Voir les détails',
    'action.help': 'Obtenir de l\'aide',
  },
  
  de: {
    // Emergency Stop
    'emergency.stop.activated': 'NOT-HALT AKTIVIERT',
    'emergency.stop.deactivated': 'Not-Halt aufgehoben',
    'emergency.stop.confirm': 'Not-Halt bestätigen',
    'emergency.stop.reason': 'Grund: {{reason}}',
    'emergency.stop.autoStop': 'Automatischer Stopp ausgelöst: {{reason}}',
    'emergency.stop.hardwareFault': 'Hardwarefehler erkannt',
    'emergency.stop.connectionLost': 'Verbindung verloren - Not-Halt aktiviert',
    'emergency.stop.testMode': 'TESTMODUS - Keine physische Aktion',
    
    // Status Messages
    'status.normal': 'System läuft normal',
    'status.warning': 'Warnzustand erkannt',
    'status.error': 'Fehlerzustand',
    'status.critical': 'Kritischer Systemfehler',
    'status.emergency': 'NOTFALL',
    
    // Actions
    'action.confirm': 'Bestätigen',
    'action.cancel': 'Abbrechen',
    'action.acknowledge': 'Bestätigen',
    'action.dismiss': 'Verwerfen',
    'action.retry': 'Wiederholen',
    'action.details': 'Details anzeigen',
    'action.help': 'Hilfe erhalten',
  },
  
  ja: {
    // Emergency Stop
    'emergency.stop.activated': '緊急停止が作動しました',
    'emergency.stop.deactivated': '緊急停止が解除されました',
    'emergency.stop.confirm': '緊急停止を確認',
    'emergency.stop.reason': '理由: {{reason}}',
    'emergency.stop.autoStop': '自動停止が作動しました: {{reason}}',
    'emergency.stop.hardwareFault': 'ハードウェア障害が検出されました',
    'emergency.stop.connectionLost': '接続が失われました - 緊急停止が作動しました',
    'emergency.stop.testMode': 'テストモード - 物理的な動作はありません',
    
    // Status Messages
    'status.normal': 'システム正常動作中',
    'status.warning': '警告状態を検出',
    'status.error': 'エラー状態',
    'status.critical': '重大なシステムエラー',
    'status.emergency': '緊急事態',
    
    // Actions
    'action.confirm': '確認',
    'action.cancel': 'キャンセル',
    'action.acknowledge': '確認',
    'action.dismiss': '閉じる',
    'action.retry': '再試行',
    'action.details': '詳細を表示',
    'action.help': 'ヘルプ',
  },
  
  zh: {
    // Emergency Stop
    'emergency.stop.activated': '紧急停止已激活',
    'emergency.stop.deactivated': '紧急停止已解除',
    'emergency.stop.confirm': '确认紧急停止',
    'emergency.stop.reason': '原因：{{reason}}',
    'emergency.stop.autoStop': '自动停止触发：{{reason}}',
    'emergency.stop.hardwareFault': '检测到硬件故障',
    'emergency.stop.connectionLost': '连接丢失 - 紧急停止已激活',
    'emergency.stop.testMode': '测试模式 - 无物理动作',
    
    // Status Messages
    'status.normal': '系统正常运行',
    'status.warning': '检测到警告状态',
    'status.error': '错误状态',
    'status.critical': '严重系统错误',
    'status.emergency': '紧急情况',
    
    // Actions
    'action.confirm': '确认',
    'action.cancel': '取消',
    'action.acknowledge': '确认',
    'action.dismiss': '关闭',
    'action.retry': '重试',
    'action.details': '查看详情',
    'action.help': '获取帮助',
  },
  
  ar: {
    // Emergency Stop
    'emergency.stop.activated': 'تم تفعيل التوقف الطارئ',
    'emergency.stop.deactivated': 'تم إلغاء التوقف الطارئ',
    'emergency.stop.confirm': 'تأكيد التوقف الطارئ',
    'emergency.stop.reason': 'السبب: {{reason}}',
    
    // Status Messages
    'status.normal': 'النظام يعمل بشكل طبيعي',
    'status.warning': 'تم اكتشاف حالة تحذير',
    'status.error': 'حالة خطأ',
    'status.critical': 'خطأ حرج في النظام',
    'status.emergency': 'حالة طوارئ',
    
    // Actions
    'action.confirm': 'تأكيد',
    'action.cancel': 'إلغاء',
    'action.acknowledge': 'إقرار',
    'action.dismiss': 'رفض',
    'action.retry': 'إعادة المحاولة',
    'action.details': 'عرض التفاصيل',
    'action.help': 'الحصول على المساعدة',
  },
  
  ru: {
    // Emergency Stop
    'emergency.stop.activated': 'АВАРИЙНАЯ ОСТАНОВКА АКТИВИРОВАНА',
    'emergency.stop.deactivated': 'Аварийная остановка отменена',
    'emergency.stop.confirm': 'Подтвердить аварийную остановку',
    'emergency.stop.reason': 'Причина: {{reason}}',
    
    // Status Messages
    'status.normal': 'Система работает нормально',
    'status.warning': 'Обнаружено предупреждение',
    'status.error': 'Состояние ошибки',
    'status.critical': 'Критическая ошибка системы',
    'status.emergency': 'АВАРИЙНАЯ СИТУАЦИЯ',
    
    // Actions
    'action.confirm': 'Подтвердить',
    'action.cancel': 'Отмена',
    'action.acknowledge': 'Подтвердить',
    'action.dismiss': 'Закрыть',
    'action.retry': 'Повторить',
    'action.details': 'Подробности',
    'action.help': 'Помощь',
  },
  
  pt: {
    // Emergency Stop
    'emergency.stop.activated': 'PARADA DE EMERGÊNCIA ATIVADA',
    'emergency.stop.deactivated': 'Parada de emergência desativada',
    'emergency.stop.confirm': 'Confirmar parada de emergência',
    'emergency.stop.reason': 'Razão: {{reason}}',
    
    // Status Messages
    'status.normal': 'Sistema operando normalmente',
    'status.warning': 'Condição de aviso detectada',
    'status.error': 'Condição de erro',
    'status.critical': 'Erro crítico do sistema',
    'status.emergency': 'EMERGÊNCIA',
    
    // Actions
    'action.confirm': 'Confirmar',
    'action.cancel': 'Cancelar',
    'action.acknowledge': 'Reconhecer',
    'action.dismiss': 'Dispensar',
    'action.retry': 'Tentar novamente',
    'action.details': 'Ver detalhes',
    'action.help': 'Obter ajuda',
  },
  
  hi: {
    // Emergency Stop
    'emergency.stop.activated': 'आपातकालीन रोक सक्रिय',
    'emergency.stop.deactivated': 'आपातकालीन रोक हटाई गई',
    'emergency.stop.confirm': 'आपातकालीन रोक की पुष्टि करें',
    'emergency.stop.reason': 'कारण: {{reason}}',
    
    // Status Messages
    'status.normal': 'सिस्टम सामान्य रूप से काम कर रहा है',
    'status.warning': 'चेतावनी स्थिति का पता चला',
    'status.error': 'त्रुटि स्थिति',
    'status.critical': 'गंभीर सिस्टम त्रुटि',
    'status.emergency': 'आपातकाल',
    
    // Actions
    'action.confirm': 'पुष्टि करें',
    'action.cancel': 'रद्द करें',
    'action.acknowledge': 'स्वीकार करें',
    'action.dismiss': 'खारिज करें',
    'action.retry': 'पुनः प्रयास करें',
    'action.details': 'विवरण देखें',
    'action.help': 'मदद लें',
  },
};

// Supported locales configuration
const supportedLocales: LocaleInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr', flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', flag: '🇸🇦' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr', flag: '🇷🇺' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr', flag: '🇵🇹' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr', flag: '🇮🇳' },
];

// Context
const LocalizationContext = createContext<LocalizationContextType | null>(null);

// Provider Props
interface LocalizationProviderProps {
  children: React.ReactNode;
  defaultLocale?: Locale;
  onLocaleChange?: (locale: Locale) => void;
}

// Provider Component
export const LocalizationProvider: React.FC<LocalizationProviderProps> = ({
  children,
  defaultLocale = 'en',
  onLocaleChange,
}) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    // Try to get locale from browser
    if (typeof window !== 'undefined') {
      const browserLang = navigator.language.split('-')[0];
      const supportedLang = supportedLocales.find(l => l.code === browserLang);
      return supportedLang ? supportedLang.code : defaultLocale;
    }
    return defaultLocale;
  });

  const localeInfo = supportedLocales.find(l => l.code === locale) || supportedLocales[0];

  // Set document direction
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = localeInfo.direction;
      document.documentElement.lang = locale;
    }
  }, [locale, localeInfo.direction]);

  // Translation function
  const t = useMemo(() => {
    return (key: string, params?: Record<string, any>): string => {
      // Get translation for current locale
      let translation = translations[locale]?.[key];
      
      // Fallback to English if not found
      if (!translation) {
        translation = translations.en[key];
      }
      
      // If still not found, return the key
      if (!translation) {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
      
      // Replace parameters
      if (params) {
        Object.entries(params).forEach(([param, value]) => {
          translation = translation.replace(new RegExp(`{{${param}}}`, 'g'), String(value));
        });
      }
      
      return translation;
    };
  }, [locale]);

  // Set locale
  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    onLocaleChange?.(newLocale);
    
    // Store in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('feedback-locale', newLocale);
    }
  };

  // Load locale from storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedLocale = localStorage.getItem('feedback-locale') as Locale;
      if (storedLocale && supportedLocales.some(l => l.code === storedLocale)) {
        setLocaleState(storedLocale);
      }
    }
  }, []);

  const value: LocalizationContextType = {
    locale,
    setLocale,
    t,
    supportedLocales,
    direction: localeInfo.direction,
  };

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
};

// Hook
export const useLocalization = (): LocalizationContextType => {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within LocalizationProvider');
  }
  return context;
};

// Utility function for external use
export const getTranslation = (locale: Locale, key: string, params?: Record<string, any>): string => {
  let translation = translations[locale]?.[key] || translations.en[key] || key;
  
  if (params) {
    Object.entries(params).forEach(([param, value]) => {
      translation = translation.replace(new RegExp(`{{${param}}}`, 'g'), String(value));
    });
  }
  
  return translation;
};

export default LocalizationProvider;