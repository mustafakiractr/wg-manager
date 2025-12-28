/**
 * Loading Components
 * Çeşitli loading durumları için yeniden kullanılabilir componentler
 */
import { Loader2 } from 'lucide-react'

// Basit spinner
export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  }

  return (
    <Loader2 className={`${sizes[size]} animate-spin ${className}`} />
  )
}

// Buton içinde kullanılacak küçük spinner
export const ButtonSpinner = ({ className = '' }) => {
  return (
    <svg
      className={`animate-spin h-4 w-4 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

// Tam sayfa loading overlay
export const LoadingOverlay = ({ message = 'Yükleniyor...' }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-2xl flex flex-col items-center gap-4">
        <Spinner size="xl" className="text-primary-600 dark:text-primary-400" />
        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {message}
        </p>
      </div>
    </div>
  )
}

// Skeleton loader - İçerik yüklenirken placeholder
export const Skeleton = ({ className = '', variant = 'default' }) => {
  const variants = {
    default: 'h-4 bg-gray-200 dark:bg-gray-700 rounded',
    text: 'h-4 bg-gray-200 dark:bg-gray-700 rounded',
    title: 'h-8 bg-gray-200 dark:bg-gray-700 rounded',
    avatar: 'w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full',
    card: 'h-32 bg-gray-200 dark:bg-gray-700 rounded-lg',
  }

  return (
    <div className={`${variants[variant]} ${className} animate-pulse`} />
  )
}

// Kart skeleton loader
export const CardSkeleton = () => {
  return (
    <div className="card animate-pulse">
      <Skeleton variant="title" className="w-1/3 mb-4" />
      <Skeleton variant="text" className="w-full mb-2" />
      <Skeleton variant="text" className="w-5/6 mb-2" />
      <Skeleton variant="text" className="w-4/6" />
    </div>
  )
}

// Tablo satırı skeleton
export const TableRowSkeleton = ({ columns = 5 }) => {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton variant="text" />
        </td>
      ))}
    </tr>
  )
}

// Inline loading text
export const LoadingText = ({ text = 'Yükleniyor' }) => {
  return (
    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
      <Spinner size="sm" />
      <span>{text}</span>
    </div>
  )
}

// Sayfa yüklenirken gösterilecek component
export const PageLoader = ({ message = 'Sayfa yükleniyor...' }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Spinner size="xl" className="text-primary-600 dark:text-primary-400" />
      <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
        {message}
      </p>
    </div>
  )
}

export default {
  Spinner,
  ButtonSpinner,
  LoadingOverlay,
  Skeleton,
  CardSkeleton,
  TableRowSkeleton,
  LoadingText,
  PageLoader,
}
