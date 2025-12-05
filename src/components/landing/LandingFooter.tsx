'use client';

import Link from 'next/link';

export function LandingFooter() {
  return (
    <footer className="bg-jet-dark text-white py-8 md:py-12 lg:py-16">
      <div className="container mx-auto px-4 md:px-page">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 lg:gap-12 mb-6 md:mb-8">
          {/* Left column: Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-emerald rounded-lg flex items-center justify-center text-white font-bold text-lg">
                S
              </div>
              <span className="text-h2 font-bold">Stacq</span>
            </Link>
            <p className="text-body text-gray-400 leading-relaxed">
              Human-curated collections for everything you want to learn.
            </p>
          </div>

          {/* Middle column: Product */}
          <div>
            <h3 className="text-h2 font-semibold mb-4">Product</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/explore" className="text-body text-gray-400 hover:text-emerald transition-colors duration-200">
                  Explore
                </Link>
              </li>
              <li>
                <Link href="/explore" className="text-body text-gray-400 hover:text-emerald transition-colors duration-200">
                  Collections
                </Link>
              </li>
              <li>
                <Link href="/explore" className="text-body text-gray-400 hover:text-emerald transition-colors duration-200">
                  Cards
                </Link>
              </li>
              <li>
                <Link href="/explore" className="text-body text-gray-400 hover:text-emerald transition-colors duration-200">
                  Stacqers
                </Link>
              </li>
              <li>
                <Link href="/explore" className="text-body text-gray-400 hover:text-emerald transition-colors duration-200">
                  Trending
                </Link>
              </li>
            </ul>
          </div>

          {/* Right column: Account */}
          <div>
            <h3 className="text-h2 font-semibold mb-4">Account</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/login" className="text-body text-gray-400 hover:text-emerald transition-colors duration-200">
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-body text-gray-400 hover:text-emerald transition-colors duration-200">
                  Sign up
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom text */}
        <div className="border-t border-gray-700 pt-8">
          <p className="text-sm text-gray-500 text-center">
            © 2025 Stacq. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

