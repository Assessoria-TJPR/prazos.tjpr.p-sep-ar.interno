const { createContext, useContext } = React;

const SettingsContext = createContext(null);
const AuthContext = createContext(null);
const BugReportContext = createContext({ openBugReport: () => {} });

const useAuth = () => {
    return useContext(AuthContext);
};