import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Algorithms from './pages/Algorithms';
import TrainingModels from './pages/TrainingModels';
import UploadResults from './pages/UploadResults';
import ResultDetail from './pages/ResultDetail';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/algorithms" element={<Algorithms />} />
        <Route path="/training-models" element={<TrainingModels />} />
        <Route path="/upload-results" element={<UploadResults />} />
        <Route path="/results/:resultId" element={<ResultDetail />} />
      </Routes>
    </Layout>
  );
}

export default App;
