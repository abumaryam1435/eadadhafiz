import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[280px] w-full flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 border-2 border-red-200 dark:border-red-900/60 rounded-3xl p-6 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto text-2xl">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-gray-900 dark:text-white">
                {this.props.fallbackTitle || 'حدث تنبيه غير متوقع'}
              </h3>
              <p className="text-xs sm:text-sm font-bold text-gray-600 dark:text-gray-300">
                لم يتم إغلاق التطبيق. تم تأمين جلسة العمل لحماية بيانات التقييمات.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/40 rounded-xl text-[11px] font-mono text-red-700 dark:text-red-300 max-h-24 overflow-y-auto text-right dir-ltr truncate">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة المحاولة والمتابعة</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Home className="w-4 h-4" />
                <span>تحديث الصفحة</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
