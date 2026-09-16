                                                                                                                                            // ============================================================
// ACCESS CONTROL MIDDLEWARE
// This is the piece that turns "authentication" into
// "authorization". Being logged in only proves WHO you are.
// These functions decide WHAT you're allowed to do.
//
// Every protected route must use these - never trust a hidden
// button or a JS check in the browser. The server is the only
// place access control actually counts.
// ============================================================

/**
 * requireAuth
 * Blocks anyone without a valid, active session.
 * Attaches req.session.user for downstream handlers to use.
 */
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'You must be logged in.' });
    }
    next();
}

/**
 * requireRole(role)
 * Blocks anyone whose session role doesn't match.
 * IMPORTANT: this checks req.session.user.role - the role that
 * was stored server-side at login time - NOT anything sent by
 * the client in the request body/query. A user editing a form
 * field or URL param cannot forge their way into this check.
 */
function requireRole(role) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: 'You must be logged in.' });
        }
        if (req.session.user.role !== role) {
            return res.status(403).json({ error: 'You do not have permission to do that.' });
        }
        next();
    };
}

module.exports = { requireAuth, requireRole };
