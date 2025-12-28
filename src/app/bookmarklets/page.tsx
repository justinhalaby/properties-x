'use client';

import { useState, useEffect } from 'react';

export default function BookmarkletsPage() {
  const [bookmarkletCode, setBookmarkletCode] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Fetch the bookmarklet code from the serve endpoint
    fetch('/api/bookmarklets/quebec-company')
      .then((res) => res.text())
      .then((code) => {
        // Convert to bookmarklet format (javascript: URI)
        // IIFE already returns undefined, no need for void() wrapper
        const bookmarkletUri = `javascript:${code}`;
        setBookmarkletCode(bookmarkletUri);
      })
      .catch((error) => {
        console.error('Failed to load bookmarklet:', error);
      });
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(bookmarkletCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Quebec Company Registry Bookmarklet</h1>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <p className="text-gray-300 mb-4">
          This bookmarklet allows you to extract company information from the Quebec Business
          Registry with a single click.
        </p>

        <div className="flex items-center gap-4">
          {bookmarkletCode ? (
            <>
              <a
                href={bookmarkletCode}
                className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors cursor-move select-none"
                onClick={(e) => {
                  // Prevent click but allow drag
                  e.preventDefault();
                }}
              >
                ↗️ Scrape Quebec Company
              </a>
              <button
                onClick={copyToClipboard}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              >
                {copied ? '✓ Copied!' : 'Copy Code'}
              </button>
            </>
          ) : (
            <div className="text-gray-400">Loading bookmarklet...</div>
          )}
        </div>
        <p className="text-sm text-yellow-400 mt-2">
          ⚠️ <strong>Important:</strong> You must <strong>DRAG</strong> the button above to your bookmarks bar. Clicking it won't work due to browser security.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">📖 Installation</h2>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <ol className="list-decimal list-inside space-y-4 text-gray-300">
              <li>
                <strong>Make your bookmarks bar visible</strong>
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-sm">
                  <li>Chrome/Edge: Press Ctrl+Shift+B (Windows) or Cmd+Shift+B (Mac)</li>
                  <li>Firefox: Press Ctrl+B (Windows) or Cmd+B (Mac)</li>
                  <li>Safari: View → Show Bookmarks Bar</li>
                </ul>
              </li>
              <li>
                <strong>DRAG the button above</strong> (↗️ Scrape Quebec Company) to your bookmarks bar
                <div className="text-yellow-400 text-sm mt-1">Note: Clicking won't work - you must drag it!</div>
              </li>
              <li>
                <strong>Alternative:</strong> Click "Copy Code", create a new bookmark manually, and paste the code as the URL
              </li>
            </ol>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">🚀 How to Use</h2>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <ol className="list-decimal list-inside space-y-4 text-gray-300">
              <li>
                Navigate to{' '}
                <a
                  href="https://www.registreentreprises.gouv.qc.ca"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  registreentreprises.gouv.qc.ca
                </a>
              </li>
              <li>
                Search for a company and open the <strong>company details page</strong>
              </li>
              <li>
                Complete any Cloudflare verification if prompted
              </li>
              <li>
                Click the <strong>"Scrape Quebec Company"</strong> bookmarklet in your bookmarks
                bar
              </li>
              <li>
                Wait for the confirmation message - the company data will be automatically saved to
                your database
              </li>
            </ol>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">📊 Data Collected</h2>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <p className="text-gray-300 mb-4">The bookmarklet extracts the following information:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>
                <strong>Company Identification</strong>: NEQ, name, status, domicile address
              </li>
              <li>
                <strong>Registration Information</strong>: Registration date, status update date
              </li>
              <li>
                <strong>Shareholders</strong>: Names, addresses, majority status, positions
              </li>
              <li>
                <strong>Administrators</strong>: Names, position titles, domicile and professional
                addresses
              </li>
              <li>
                <strong>Economic Activity</strong>: CAE code and description
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">❓ FAQ</h2>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-white mb-2">
                Why use a bookmarklet instead of automated scraping?
              </h3>
              <p className="text-gray-300 text-sm">
                The Quebec Business Registry has Cloudflare protection and robots.txt restrictions.
                By using a bookmarklet, you manually navigate to the page (handling any verifications),
                and the extraction happens client-side, bypassing these restrictions.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">
                What if I get an error?
              </h3>
              <p className="text-gray-300 text-sm">
                Make sure you're on the company details page (not the search results). The page
                should show all company information including NEQ, shareholders, and administrators.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">
                Can I scrape multiple companies at once?
              </h3>
              <p className="text-gray-300 text-sm">
                Currently, you need to click the bookmarklet for each company. A future update may
                support bulk scraping.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">
                What happens if I scrape the same company twice?
              </h3>
              <p className="text-gray-300 text-sm">
                The system detects duplicates by NEQ. If the company already exists, you'll see a
                message indicating it's already in the database.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">🔒 Privacy & Security</h2>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>The bookmarklet only runs when you click it</li>
              <li>Data is sent directly from your browser to your own server</li>
              <li>No third-party services are involved</li>
              <li>The bookmarklet code is open source and can be inspected</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">🌐 Browser Compatibility</h2>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <p className="text-gray-300 mb-4">Tested and working on:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              <li>Google Chrome</li>
              <li>Microsoft Edge</li>
              <li>Mozilla Firefox</li>
              <li>Safari</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
