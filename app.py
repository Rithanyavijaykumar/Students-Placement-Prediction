from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(BASE_DIR, "placements.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


# ── Model ────────────────────────────────────────────────────────────────────
class Assessment(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(100), nullable=False)
    branch      = db.Column(db.String(100), nullable=False)
    cgpa        = db.Column(db.Float, nullable=False)
    backlogs    = db.Column(db.Integer, nullable=False)
    internships = db.Column(db.Integer, nullable=False)
    projects    = db.Column(db.Integer, nullable=False)
    aptitude    = db.Column(db.Float, nullable=False)
    problem_solving = db.Column(db.Float, nullable=False)
    communication   = db.Column(db.Float, nullable=False)
    technical       = db.Column(db.Float, nullable=False)
    score       = db.Column(db.Float, nullable=False)
    result      = db.Column(db.String(20), nullable=False)   # "Ready" / "Average" / "Needs Work"
    message     = db.Column(db.String(300), nullable=False)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id":             self.id,
            "name":           self.name,
            "branch":         self.branch,
            "cgpa":           self.cgpa,
            "backlogs":       self.backlogs,
            "internships":    self.internships,
            "projects":       self.projects,
            "aptitude":       self.aptitude,
            "problem_solving":self.problem_solving,
            "communication":  self.communication,
            "technical":      self.technical,
            "score":          self.score,
            "result":         self.result,
            "message":        self.message,
            "created_at":     self.created_at.strftime("%d %b %Y, %I:%M %p"),
        }


# ── Score engine ─────────────────────────────────────────────────────────────
def calculate(data: dict) -> dict:
    cgpa        = float(data["cgpa"])
    backlogs    = int(data["backlogs"])
    internships = int(data["internships"])
    projects    = int(data["projects"])
    aptitude    = float(data["aptitude"])
    problem_solving = float(data["problem_solving"])
    communication   = float(data["communication"])
    technical       = float(data["technical"])

    cgpa_score       = (cgpa / 10) * 100
    experience_score = (internships * 15) + (projects * 10)
    backlog_penalty  = backlogs * 10

    total_score = (
        cgpa_score + aptitude + problem_solving +
        communication + technical + experience_score - backlog_penalty
    ) / 6

    total_score = max(0, min(total_score, 100))

    if total_score >= 75 and backlogs == 0:
        result  = "Ready"
        message = "Great job! You are well-prepared for placements."
    elif total_score >= 60:
        result  = "Average"
        message = "Good progress! Keep improving your weak areas."
    else:
        result  = "Needs Work"
        message = "You have potential. Focus on improving your skills."

    suggestions = []
    if cgpa < 7:            suggestions.append("Improve your CGPA above 7.0")
    if internships == 0:    suggestions.append("Complete at least one internship")
    if projects < 2:        suggestions.append("Build at least 2 major projects")
    if aptitude < 60:       suggestions.append("Strengthen aptitude & reasoning skills")
    if problem_solving < 60:suggestions.append("Practice Data Structures & Algorithms")
    if communication < 60:  suggestions.append("Work on communication & soft skills")
    if technical < 60:      suggestions.append("Deepen your technical knowledge")
    if backlogs > 0:        suggestions.append("Clear all active backlogs")

    return {
        "score":       round(total_score, 2),
        "result":      result,
        "message":     message,
        "suggestions": suggestions,
    }


# ── Page routes ───────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return render_template("index.html")


@app.route("/history")
def history_page():
    return render_template("history.html")


@app.route("/dashboard")
def dashboard_page():
    return render_template("dashboard.html")


# ── API routes ────────────────────────────────────────────────────────────────
@app.route("/api/predict", methods=["POST"])
def api_predict():
    body = request.get_json(silent=True) or request.form.to_dict()

    required = ["name", "branch", "cgpa", "backlogs", "internships",
                "projects", "aptitude", "problem_solving", "communication", "technical"]
    missing = [f for f in required if f not in body or str(body[f]).strip() == ""]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    try:
        result = calculate(body)
    except (ValueError, TypeError) as e:
        return jsonify({"error": f"Invalid input: {e}"}), 400

    entry = Assessment(
        name        = str(body["name"]).strip(),
        branch      = str(body["branch"]).strip(),
        cgpa        = float(body["cgpa"]),
        backlogs    = int(body["backlogs"]),
        internships = int(body["internships"]),
        projects    = int(body["projects"]),
        aptitude    = float(body["aptitude"]),
        problem_solving = float(body["problem_solving"]),
        communication   = float(body["communication"]),
        technical       = float(body["technical"]),
        score   = result["score"],
        result  = result["result"],
        message = result["message"],
    )
    db.session.add(entry)
    db.session.commit()

    return jsonify({**result, "id": entry.id}), 200


@app.route("/api/history", methods=["GET"])
def api_history():
    page     = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)
    branch   = request.args.get("branch", "")
    result   = request.args.get("result", "")

    query = Assessment.query
    if branch:
        query = query.filter(Assessment.branch.ilike(f"%{branch}%"))
    if result:
        query = query.filter(Assessment.result == result)

    paginated = query.order_by(Assessment.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "items":       [a.to_dict() for a in paginated.items],
        "total":       paginated.total,
        "pages":       paginated.pages,
        "current_page":paginated.page,
    })


@app.route("/api/history/<int:entry_id>", methods=["DELETE"])
def api_delete(entry_id):
    entry = db.session.get(Assessment, entry_id)
    if not entry:
        return jsonify({"error": "Record not found"}), 404
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"message": "Deleted successfully"}), 200


@app.route("/api/stats", methods=["GET"])
def api_stats():
    total   = Assessment.query.count()
    ready   = Assessment.query.filter_by(result="Ready").count()
    average = Assessment.query.filter_by(result="Average").count()
    needs   = Assessment.query.filter_by(result="Needs Work").count()

    avg_score = db.session.query(db.func.avg(Assessment.score)).scalar() or 0
    avg_cgpa  = db.session.query(db.func.avg(Assessment.cgpa)).scalar() or 0

    # Avg skill scores
    avg_apt  = db.session.query(db.func.avg(Assessment.aptitude)).scalar() or 0
    avg_ps   = db.session.query(db.func.avg(Assessment.problem_solving)).scalar() or 0
    avg_comm = db.session.query(db.func.avg(Assessment.communication)).scalar() or 0
    avg_tech = db.session.query(db.func.avg(Assessment.technical)).scalar() or 0

    # Branch distribution
    branch_rows = db.session.query(
        Assessment.branch, db.func.count(Assessment.id)
    ).group_by(Assessment.branch).all()
    branches = [{"branch": r[0], "count": r[1]} for r in branch_rows]

    # Score trend (last 10)
    recent = Assessment.query.order_by(Assessment.created_at.desc()).limit(10).all()
    trend  = [{"name": a.name, "score": a.score, "date": a.created_at.strftime("%d %b")}
              for a in reversed(recent)]

    # Top 5 performers
    top = Assessment.query.order_by(Assessment.score.desc()).limit(5).all()
    top_performers = [{"name": a.name, "branch": a.branch, "score": a.score, "result": a.result}
                      for a in top]

    return jsonify({
        "total":     total,
        "ready":     ready,
        "average":   average,
        "needs_work":needs,
        "avg_score": round(avg_score, 2),
        "avg_cgpa":  round(avg_cgpa, 2),
        "avg_skills": {
            "aptitude":       round(avg_apt, 1),
            "problem_solving":round(avg_ps, 1),
            "communication":  round(avg_comm, 1),
            "technical":      round(avg_tech, 1),
        },
        "branches":       branches,
        "trend":          trend,
        "top_performers": top_performers,
    })


# ── Bootstrap ─────────────────────────────────────────────────────────────────
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True)
