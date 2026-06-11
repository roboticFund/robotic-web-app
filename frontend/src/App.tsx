import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Algorithms from './pages/Algorithms';
import TrainingModels from './pages/TrainingModels';
import AlgorithmVersions from './pages/AlgorithmVersions';
import AlgorithmVersionDetail from './pages/AlgorithmVersionDetail';
import UploadResults from './pages/UploadResults';
import ResultDetail from './pages/ResultDetail';
import Results from './pages/Results';
import Admin from './pages/Admin';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/algorithms" element={<Algorithms />} />
        <Route path="/training-models" element={<TrainingModels />} />
        <Route path="/algorithm-versions" element={<AlgorithmVersions />} />
        <Route path="/algorithm-versions/:versionId" element={<AlgorithmVersionDetail />} />
        <Route path="/results" element={<Results />} />
        <Route path="/upload-results" element={<UploadResults />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/results/:resultId" element={<ResultDetail />} />
      </Routes>
    </Layout>
  );
}

export default App;
