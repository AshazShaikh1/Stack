import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface PaymentSuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function PaymentSuccessPage({ searchParams }: PaymentSuccessPageProps) {
  const params = await searchParams;
  const sessionId = params.session_id;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-jet-dark mb-2">Payment Successful!</h1>
          <p className="text-gray-muted">
            Thank you for your payment. Your purchase has been processed successfully.
          </p>
          {sessionId && (
            <p className="text-sm text-gray-muted mt-2">
              Session ID: {sessionId.substring(0, 20)}...
            </p>
          )}
        </div>

        <div className="flex gap-4 justify-center">
          <Link href="/feed">
            <Button variant="primary">Go to Feed</Button>
          </Link>
          <Link href="/explore">
            <Button variant="outline">Explore Stacks</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

