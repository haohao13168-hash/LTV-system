import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { StoreProvider } from "@/lib/store";
import { SettingsProvider } from "@/lib/settings";
import { AuthProvider } from "@/lib/auth";
import AppShell from "@/components/AppShell";

export const metadata = {
  title: "LTV-PNS-DASH",
  description: "Lifetime value & partner-network dashboard",
};

const PRE_HYDRATE = `(function(){
  try {
    var s = JSON.parse(localStorage.getItem('marketing-dashboard-settings') || '{}');
    var r = document.documentElement;
    if (s.theme === 'light' || s.theme === 'dark') r.setAttribute('data-theme', s.theme);
    if (s.fontSize) r.setAttribute('data-font-size', s.fontSize);
    var accents = {
      coral: '5 80% 70%', lavender: '265 75% 75%', pink: '330 80% 65%',
      deepCyan: '190 90% 38%', lightCyan: '190 85% 62%', gold: '48 95% 58%',
      amberGold: '35 88% 52%', emerald: '155 65% 48%'
    };
    if (s.accent && accents[s.accent]) r.style.setProperty('--color-accent', accents[s.accent]);
    var migrate = { blue:'lightCyan', indigo:'lavender', violet:'lavender', orange:'amberGold', amber:'gold', green:'emerald', teal:'deepCyan' };
    if (s.accent && migrate[s.accent] && accents[migrate[s.accent]]) r.style.setProperty('--color-accent', accents[migrate[s.accent]]);
  } catch(e) {}
})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRE_HYDRATE }} />
      </head>
      <body>
        <SettingsProvider>
          <I18nProvider>
            <StoreProvider>
              <AuthProvider>
                <AppShell>{children}</AppShell>
              </AuthProvider>
            </StoreProvider>
          </I18nProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
