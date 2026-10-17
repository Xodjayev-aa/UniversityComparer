import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AboutPage } from './pages/About';
import { AdminPage } from './pages/Admin';
import { ComparePage } from './pages/Compare';
import { CountriesPage } from './pages/Countries';
import { CoveragePage } from './pages/Coverage';
import { HomePage } from './pages/Home';
import { InstallPage } from './pages/Install';
import { InstitutionPage } from './pages/Institution';
import { NotFoundPage } from './pages/NotFound';
import { PrivacyPage } from './pages/Privacy';
import { ReportPage } from './pages/Report';
import { SearchPage } from './pages/Search';
import { ShortlistPage } from './pages/Shortlist';
import { SubjectsPage } from './pages/Subjects';
import { TermsPage } from './pages/Terms';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="university/:id" element={<InstitutionPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="shortlist" element={<ShortlistPage />} />
        <Route path="countries" element={<CountriesPage />} />
        <Route path="countries/:code" element={<CountriesPage />} />
        <Route path="subjects" element={<SubjectsPage />} />
        <Route path="coverage" element={<CoveragePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="install" element={<InstallPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
