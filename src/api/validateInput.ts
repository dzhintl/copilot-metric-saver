// validateInput.ts

/**
 * Interface representing the result of scope validation.
 */
export interface ScopeValidationResult {
    isValid: boolean;
    normalizedScopeType: string;
    normalizedTeamSlug: string;
    errorMessage?: string;
}

/**
 * Validates the input parameters for scopeType, scopeName, token, and team_slug.
 * 
 * @param scopeType - The type of scope, expected to be 'organization' or 'enterprise'.
 * @param scopeName - The name of the scope, must follow the naming rules for organization or enterprise.
 * @param token - The GitHub token, expected to follow the format 'ghp_[A-Za-z0-9]{36}'.
 * @param team_slug - (Optional) The team slug, must follow the naming rules for team.
 * @returns {ScopeValidationResult} - The result of the validation, including normalized values and error message if any.
 */
export function validateScope(scopeType: string, scopeName: string, token: string, team_slug?: string): ScopeValidationResult {
    if (!scopeType || !scopeName || !token) {
        return { isValid: false, normalizedScopeType: '', normalizedTeamSlug: '', errorMessage: 'scopeType, scopeName, or token is undefined or empty' };
    }

    // Convert scopeType to lowercase
    scopeType = scopeType.toLowerCase();

    // Normalize scopeType
    if (scopeType === 'orgs') {
        scopeType = 'organization';
    } else if (scopeType === 'enterprises') {
        scopeType = 'enterprise';
    }

    const scopeTypeRegex = /^(organization|enterprise)$/;
    const orgRegex = /^(?!-)[A-Za-z0-9-]{1,39}(?<!-)$/;
    const enterpriseRegex = /^(?!-)[A-Za-z0-9-]{1,60}(?<!-)$/;
    const teamRegex = /^(?!-)[A-Za-z0-9-]{1,39}(?<!-)$/;
    // Token regex updated to allow for any length of token, not just 36 characters, and to allow for any characters in the token, and starts with 'ghp_' or 'github_pat_'
    const tokenRegex = /^(ghp|github_pat)_.*$/;

    if (!scopeTypeRegex.test(scopeType)) {
        return { isValid: false, normalizedScopeType: '', normalizedTeamSlug: '', errorMessage: 'Invalid scopeType' };
    }

    if (scopeType === 'organization' && !orgRegex.test(scopeName)) {
        return { isValid: false, normalizedScopeType: '', normalizedTeamSlug: '', errorMessage: 'Invalid scopeName for organization' };
    }

    if (scopeType === 'enterprise' && !enterpriseRegex.test(scopeName)) {
        return { isValid: false, normalizedScopeType: '', normalizedTeamSlug: '', errorMessage: 'Invalid scopeName for enterprise' };
    }

    if (team_slug && !teamRegex.test(team_slug)) {
        return { isValid: false, normalizedScopeType: '', normalizedTeamSlug: '', errorMessage: 'Invalid team_slug' };
    }

    if (!tokenRegex.test(token)) {
        return { isValid: false, normalizedScopeType: '', normalizedTeamSlug: '', errorMessage: 'Invalid token format' };
    }

    // If team_slug is undefined or empty, return an empty string
    const normalizedTeamSlug = team_slug ? team_slug : '';

    return { isValid: true, normalizedScopeType: scopeType, normalizedTeamSlug };
}