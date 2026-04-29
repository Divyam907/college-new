\documentclass[conference]{IEEEtran}
\IEEEoverridecommandlockouts
% The preceding line is only needed to identify funding in the first footnote. If that is unneeded, please comment it out.
\usepackage{cite}
\usepackage{amsmath,amssymb,amsfonts}
\usepackage{algorithmic}
\usepackage{graphicx}
\usepackage{textcomp}
\usepackage{xcolor}
\usepackage{url}
\def\BibTeX{{\rm B\kern-.05em{\sc i\kern-.025em b}\kern-.08em
    T\kern-.1667em\lower.7ex\hbox{E}\kern-.125emX}}
\begin{document}

\title{Automated Attendence System Using Facial Recognition}

\author{\IEEEauthorblockN{1\textsuperscript{st} Author Name}
\IEEEauthorblockA{\textit{Department Name} \\
{\itshape Institution Name}\\
City, Country \\
email address}
\and
\IEEEauthorblockN{2\textsuperscript{nd} Author Name}
\IEEEauthorblockA{\textit{Department Name} \\
{\itshape Institution Name}\\
City, Country \\
email address}
\and
\IEEEauthorblockN{3\textsuperscript{rd} Author Name}
\IEEEauthorblockA{\textit{Department Name} \\
{\itshape Institution Name}\\
City, Country \\
email address}
\and
\IEEEauthorblockN{4\textsuperscript{th} Author Name}
\IEEEauthorblockA{\textit{Department Name} \\
{\itshape Institution Name}\\
City, Country \\
email address}
\and
\IEEEauthorblockN{5\textsuperscript{th} Author Name}
\IEEEauthorblockA{\textit{Department Name} \\
{\itshape Institution Name}\\
City, Country \\
email address}
\and
\IEEEauthorblockN{6\textsuperscript{th} Author Name}
\IEEEauthorblockA{\textit{Department Name} \\
{\itshape Institution Name}\\
City, Country \\
email address}}

\maketitle

\begin{abstract}
This paper presents an automated attendence system using facial recognition and developed around the current repository implementation. The objective of the project is to replace slow and error prone manual attendence entry with a practical digital workflow that supports student enrollment, identity verification, subject wise attendence marking, report generation, and email based communication. The system uses DeepFace and the VGG-Face model for facial embedding generation and identity matching, OpenCV for image processing, PostgreSQL for persistent data storage, and Flask for a role based web portal. The implemented solution supports two operational modes. In the first mode, an administrator registers students through a webcam enabled interface, stores images in a dataset, and regenerates face embeddings for recognition. In the second mode, college staff use a camera driven attendence portal to capture classroom images, select the active subject, and mark attendence for recognized students in real time. The repository also supports scheduled batch processing, daily weekly monthly Excel report generation, and SMTP based email delivery. This paper expands on the architecture, workflow, recognition method, database design, practical advantages, current limitations, and implementation observations of the proposed system.
\end{abstract}

\begin{IEEEkeywords}
attendence automation, facial recognition, DeepFace, Flask, PostgreSQL, web portal, report generation, student registration
\end{IEEEkeywords}

\section{Introduction}
Manual attendence recording is still common in many colleges, especially in classrooms where the instructor verifies student presence by calling names or circulating a sign sheet. Although simple, such methods interrupt teaching time, create opportunities for proxy presence, and make retrospective analysis difficult. When the number of students, subjects, and classroom sessions increases, manual records become fragmented and error prone. It also becomes difficult to produce timely daily, weekly, or monthly summaries for faculty members and administrators.

With the growth of deep learning based computer vision, face recognition has become a practical solution for identity verification in controlled environments \cite{b1}, \cite{b2}, \cite{b3}, \cite{b11}, \cite{b13}, \cite{b14}. Frameworks such as DeepFace make it possible to use modern face recognition backends without implementing the full neural pipeline from scratch \cite{b4}, \cite{b9}. This significantly reduces development effort and makes face based attendence feasible for academic projects and small institutional deployments. A realistic system, however, requires more than a recognition function. It needs data storage, user roles, enrollment logic, subject management, reporting, and a usable interface for day to day operation.

The current repository addresses that broader requirement. Instead of providing only an experimental face matching script, it integrates student registration, embedding generation, subject aware attendence marking, scheduled image processing, report generation, and email delivery. A role based Flask portal has been added so that administrators and college staff can work through separate interfaces. The admin portal supports webcam based student registration and report dispatch. The college portal supports camera based attendence capture, subject selection, and real time response after matching students against stored embeddings.

The main contributions of the implemented project are summarized below:
\begin{itemize}
\item a complete end to end attendence workflow rather than an isolated recognition module,
\item image based student registration through an admin portal,
\item face matching using DeepFace representations generated from the VGG-Face model,
\item PostgreSQL backed storage for students, subjects, users, and attendence records,
\item subject wise attendence marking through both scheduled and on demand modes,
\item automatic generation of Excel reports for multiple time ranges, and
\item email based report delivery directly from the application dashboard.
\end{itemize}

\section{Problem Statement and Objectives}
The central problem addressed by this project is the lack of an efficient, reliable, and traceable attendence mechanism for classroom environments. In a typical manual setting, faculty members spend several minutes verifying student presence, then later spend additional time preparing reports. This overhead grows with class size. Manual methods also offer limited protection against duplicate marking, record loss, or false proxy attendence. Even when spreadsheets are used, the process is still dependent on human entry and repeated administrative effort.

The objective of the proposed system is to build a practical software platform that reduces human effort while maintaining an understandable implementation. The system is designed to meet the following goals:
\begin{itemize}
\item reduce time spent during classroom attendence collection,
\item use facial recognition to verify student identity from stored photo samples,
\item support role separation between system administration and classroom operation,
\item maintain persistent structured records in a relational database,
\item generate academic reports automatically for different time periods, and
\item provide an extendable software base for future deployment enhancements.
\end{itemize}

These goals are reflected directly in the repository structure and in the actual features already implemented in the project.

\section{System Overview}
The system follows a modular architecture in which enrollment, recognition, record storage, reporting, and communication are handled by separate Python modules. This separation improves readability and makes the project easier to extend. At a high level, the system can be viewed as a pipeline with five stages: user authentication, student registration, embedding preparation, attendence marking, and report generation. Each stage interacts with either the dataset directory, the PostgreSQL database, or both.

Two distinct operating styles are supported in the repository. The first is an interactive web based workflow where users open the admin or college portal and work through browser pages backed by Flask routes. The second is a batch workflow where the system reads image files from disk and processes them according to class schedule timings. The coexistence of these two modes makes the project more flexible because it can be used for demonstrations, classroom operation, or later integration with automated capture devices.

The overall architecture and the operational face recognition workflow used in the repository are illustrated in Fig.~\ref{fig:architecture_workflow}. The figure summarizes how classroom image acquisition, preprocessing, feature extraction, database matching, attendence marking, report generation, and email dispatch are linked into one complete application.

\begin{figure}[htbp]
\raggedright
\setlength{\fboxsep}{1pt}
\fbox{\includegraphics[width=0.25\textwidth,height=0.25\textheight,keepaspectratio]{figures/system_architecture_workflow.png}}
\caption{System architecture and face recognition workflow of the proposed automated attendence system.}
\label{fig:architecture_workflow}
\end{figure}

\subsection{Admin Portal}
The admin workflow is implemented in \texttt{app.py}. After sign up and login, an administrator can access a dashboard that summarizes student count, subject count, and current day attendence volume. The admin can register a new student directly through a webcam enabled page. Captured student photos are stored in the dataset directory under a folder named after the student, and the student record is simultaneously inserted into the database.

After registration, the system regenerates embeddings so that the new student immediately becomes available to the recognition engine. This eliminates the need for manual dataset preparation outside the software. The admin dashboard also provides report sending controls, allowing the user to trigger daily, weekly, or monthly email reports for a selected date range. This addition transforms the repository from a pure recognition prototype into a usable academic management tool.

\subsection{College Attendance Portal}
The college portal is intended for the operational classroom user. A college staff member logs in, opens the attendence page, selects the active subject from the list stored in the database, and captures a classroom image through the webcam. The application stores the captured image in a working directory, extracts faces, compares each face with the embedding repository, and inserts attendence entries for the accepted matches.

The subject selection feature is important because it removes a major limitation of purely time based mapping. Earlier versions relied only on the image filename time to identify the correct subject, which caused failure when testing outside official lecture hours. The current portal solves that issue by letting the user explicitly choose the subject during manual attendence marking. As a result, the recognition pipeline can be executed at any time while still attaching the attendence to the intended class.

\subsection{Scheduled Batch Mode}
The repository also contains a scheduler in \texttt{Schedule.py}. In this mode, classroom images placed in the image directory are processed automatically at configured times. Filenames follow the \texttt{HH-MM-SS.jpg} pattern, which is interpreted as the classroom capture time. The application compares that time against the \texttt{from\_time} and \texttt{to\_time} fields stored in the subject table and selects the matching subject automatically.

This batch style operation is valuable when image capture is handled by an external process, for example a classroom camera or an operator who periodically uploads files. The scheduled mode also connects directly with report generation and email sending, which makes it suitable for automated daily processing.

\subsection{Authentication and Role Management}
Role separation is handled through the \texttt{users} table and session based authentication in Flask. Passwords are stored using hashing rather than plain text, and users are restricted to either \texttt{admin} or \texttt{college} roles. This distinction is essential because student enrollment, report management, and classroom attendence capture are operationally different tasks. The design is simple, but it is sufficient for a college level management workflow and can be expanded later with role hierarchies or department wise access rules.

\section{Recognition and Attendance Method}
The recognition logic is implemented in \texttt{Attendance\_update\_db.py}. The method begins during enrollment, where student face images are stored in the dataset and converted into numerical representations by \texttt{gen\_embed.py}. These embeddings are written to \texttt{embeddings.csv}, which functions as a compact feature repository for matching at inference time.

When a classroom image is provided, the system first reads the image using OpenCV and then uses DeepFace with an MTCNN based detector to identify facial regions \cite{b2}, \cite{b4}, \cite{b12}. For each detected face, the system extracts an embedding using the VGG-Face model \cite{b3}, \cite{b15}. The embedding is then compared with every stored student embedding in the repository.

The use of embedding comparison rather than direct pixel comparison is important because the embedding space captures identity related information in a more robust form. This makes the system more tolerant to moderate differences in pose, expression, and background than simple image matching.

\subsection{Enrollment and Embedding Generation}
The embedding generation stage is a core part of the system because recognition quality depends directly on the quality and diversity of enrollment images. For each registered student, the repository stores one or more facial images inside a dedicated folder. The embedding generation script iterates through all student directories, reads each image, extracts a face representation, and writes the resulting feature vectors along with the corresponding names into a structured CSV file.

This design has two advantages. First, embeddings do not need to be recomputed for every recognition request, which reduces repeated processing time. Second, the dataset remains human readable because the original student images are kept alongside the generated numerical representation file.

\subsection{Attendance Inference Pipeline}

For a detected face embedding $e_q$ and a stored student embedding $e_i$, the Euclidean distance is computed as
\begin{equation}
d_i = \lVert e_q - e_i \rVert_2.
\end{equation}
The identity corresponding to the minimum distance is selected,
\begin{equation}
d_{min} = \min_i d_i,
\end{equation}
and a simple confidence estimate is derived by
\begin{equation}
c = \frac{1}{1 + d_{min}}.
\end{equation}

In the current repository, a distance threshold of $0.9$ is used to reject weak matches. This threshold prevents obviously different faces from being force matched to the nearest known identity. If the minimum distance is above the threshold, the face is treated as unmatched and no attendence insertion is performed for that face. This approach is preferable to always assigning the closest identity because forced matching increases false positives.

Once a valid identity is found, the corresponding student identifier is retrieved from the student table. The system then constructs the attendence record using the date, subject identifier, student identifier, and image path. A duplicate check is performed before insertion so that repeated processing of the same image does not create redundant attendence records.

\subsection{Subject Association and Duplicate Control}
The repository now supports two mechanisms for subject association. In scheduled mode, the subject is inferred from the time encoded in the image filename. In portal mode, the subject is explicitly selected by the college user. This dual design is practical because it supports both automated classroom processing and manual testing or operation outside fixed lecture hours.

Duplicate control is handled in the database insertion logic. Before writing a new attendence row, the system checks whether the same student has already been marked for the same subject on the same date. If a row is already present, insertion is skipped. This simple constraint reduces data inflation and keeps generated reports consistent.

\section{Software Modules and Database Design}
The repository is split into specialized modules so that enrollment, recognition, reporting, communication, and web interaction remain separated. This modular design improves maintainability because changes in one part of the system are less likely to break another part.

\subsection{Repository Modules}
The main files and their responsibilities are summarized below. The table is included to show how the repository maps functional requirements into code level modules.

\begin{table}[htbp]
\caption{Major Repository Modules}
\begin{center}
\footnotesize
\begin{tabular}{|p{0.27\columnwidth}|p{0.60\columnwidth}|}
\hline
\textbf{Module} & \textbf{Primary Responsibility} \\
\hline
\texttt{app.py} & Web routes for login, sign up, admin dashboard, student registration, college attendence marking, and report triggering. \\
\hline
\texttt{Attendance\_update\_db.py} & Face detection, embedding comparison, subject mapping, and database insertion for attendence. \\
\hline
\texttt{gen\_embed.py} & Dataset traversal and generation of \texttt{embeddings.csv} for recognition. \\
\hline
\texttt{generate\_report.py} & Creation of daily, weekly, and monthly report data using pandas queries. \\
\hline
\texttt{send\_report.py} & Excel export and SMTP based distribution of reports. \\
\hline
\texttt{Schedule.py} & Timed execution of image processing and automated reporting. \\
\hline
\end{tabular}
\end{center}
\end{table}

The module separation also reflects a sound engineering decision. For example, the recognition file does not directly manage the web interface, and the reporting module does not need to understand the details of face extraction. This makes testing and extension more manageable.

The main files and their responsibilities are as follows:
\begin{itemize}
\item \texttt{app.py}: login, sign up, admin portal, college portal, subject selection, student registration, and report triggers.
\item \texttt{Attendance\_update\_db.py}: face detection, embedding comparison, subject lookup, and attendance insertion.
\item \texttt{gen\_embed.py}: generation of \texttt{embeddings.csv} from the dataset directory.
\item \texttt{generate\_report.py}: daily, weekly, and monthly attendance report generation using pandas.
\item \texttt{send\_report.py}: email ready wrappers that export Excel reports and dispatch them through SMTP.
\item \texttt{Schedule.py}: periodic execution of the attendance and reporting pipeline.
\end{itemize}

\subsection{Database Tables}
The current implementation uses PostgreSQL with at least four operational tables. The schema is intentionally compact so that the project remains understandable while still supporting complete workflows.

\begin{table}[htbp]
\caption{Core Database Entities}
\begin{center}
\footnotesize
\begin{tabular}{|p{0.22\columnwidth}|p{0.65\columnwidth}|}
\hline
\textbf{Table} & \textbf{Description} \\
\hline
\texttt{users} & Stores portal user accounts, hashed passwords, and role labels for admin and college access. \\
\hline
\texttt{student} & Stores registered student identity information such as student id, name, and optional email. \\
\hline
\texttt{subject} & Stores subject name, faculty identifier, and the time range used for schedule based mapping. \\
\hline
\texttt{attendance} & Stores the attendence transaction itself, including date, subject id, student id, and source image path. \\
\hline
\end{tabular}
\end{center}
\end{table}

This schema supports role based access control, time aware class mapping, and report generation through straightforward SQL queries. It is also easy to extend with future entities such as department, timetable, section, semester, or audit logs.

The current implementation uses PostgreSQL with at least four operational tables:
\begin{itemize}
\item \texttt{users}: portal accounts with hashed passwords and role values \texttt{admin} or \texttt{college},
\item \texttt{student}: student identifier, name, and optional email,
\item \texttt{subject}: subject name, faculty identifier, and class time range, and
\item \texttt{attendance}: attendance date, subject identifier, student identifier, and stored image path.
\end{itemize}

This schema supports both manual portal based marking and scheduled folder based execution.

\section{Report Generation and Email Workflow}
An important feature of the repository is automated reporting. The reporting pipeline is implemented primarily in \texttt{generate\_report.py} and \texttt{send\_report.py}. The daily report pivots attendence by subject and student name for a selected date. The weekly report aggregates the number of days present between a start date and an end date. The monthly report computes total classes, presents, absences, and attendence percentage for each student subject pair.

These report types support different levels of academic monitoring. Daily reporting is useful for immediate verification of classroom events. Weekly reporting helps faculty review patterns over multiple sessions. Monthly reporting is more suitable for administrative review and can be used to identify students with insufficient attendence percentages.

\subsection{Scheduled and On Demand Reporting}
The repository supports both scheduled reporting and dashboard triggered reporting. In scheduled mode, \texttt{Schedule.py} can execute the report pipeline automatically at fixed times. In on demand mode, the admin dashboard allows the user to choose daily, weekly, or monthly report mode and send the result directly by email. This on demand control is useful when an administrator wants to generate reports for a specific date rather than waiting for the scheduler.

Generated reports are stored as Excel files. The use of spreadsheet output is practical because academic staff commonly rely on tabular office documents for verification, printing, and forwarding. The project therefore produces outputs that are technically structured but still familiar to end users.

\subsection{Email Delivery}
The email layer uses SMTP and currently supports Gmail configuration. Recipient lists are stored in the configuration file. The admin interface can trigger delivery of reports directly to the configured recipient mailbox. Exception handling has also been included in the sending workflow so that email failures do not silently corrupt the attendence generation process.

This report and email capability is a major strength of the repository because it turns raw attendence data into actionable communication. In many academic systems, report preparation is separate from attendence collection. Here, both operations are integrated in one workflow.

\section{Portal Workflow}
The complete workflow of the implemented project is summarized below.
\begin{enumerate}
\item An admin signs in to the portal and registers a student by capturing facial images.
\item The images are stored in the dataset folder and converted into embeddings.
\item A college staff user logs in to the attendance portal and selects the active subject.
\item A classroom image is captured through the webcam.
\item The system detects faces, computes embeddings, compares them with registered embeddings, and accepts only those matches that satisfy the threshold.
\item Recognized students are inserted into the attendance table.
\item Reports can then be generated automatically by schedule or manually from the admin portal.
\end{enumerate}

This sequence may appear simple from a user perspective, but it involves coordinated interaction between the browser, the filesystem, the recognition pipeline, and the database. The admin side focuses on data quality and enrollment. The college side focuses on rapid and reliable classroom operation. Because both users interact through a browser, the system avoids command line complexity during normal use.

The dual workflow gives the project practical flexibility. Real time operation is handled by the portal, while repetitive institutional reporting can run in the background. This is an important design choice because educational environments often need both kinds of execution: interactive when a class is in progress and automated when records must be prepared without operator involvement.

\section{Results and Qualitative Observations}
The present repository has been validated primarily through functional testing rather than through a formal benchmark dataset. Even so, several useful observations can be drawn from the implemented workflow. First, webcam based student registration successfully creates a new dataset folder, inserts the student into the database, and regenerates the embedding file so the student becomes immediately available for recognition. This confirms that the admin enrollment pipeline is operational.

Second, image based attendence marking successfully performs face detection, selects a subject, matches recognized faces against stored embeddings, and records attendence in PostgreSQL. The system also prevents duplicate attendence for the same student, subject, and date. This behavior is important because classroom images can be processed more than once in development or during repeated testing.

Third, report generation creates spreadsheet files for daily, weekly, and monthly summaries. These files can be sent through the admin portal email feature. This demonstrates that the project is not limited to recognition alone but covers the full administrative cycle of collection, storage, reporting, and communication.

Finally, the introduction of manual subject selection in the college portal resolved the practical issue that occurred when attendence was captured outside official lecture hours. This shows that the repository evolved in response to real usage behavior and not only theoretical design assumptions.

\section{Discussion}
The repository demonstrates that a useful attendence system can be built from standard open source components when the architecture is carefully organized. Flask provides a lightweight web layer \cite{b7}, PostgreSQL provides structured persistence \cite{b6}, OpenCV supports image handling \cite{b5}, and DeepFace simplifies the use of modern facial recognition backends \cite{b4}. The system also relies on TensorFlow \cite{b17} and Keras \cite{b18} as the deep learning backend for embedding generation, SQLAlchemy \cite{b19} for database abstraction, and NumPy \cite{b20} for numerical operations during embedding comparison. The use of a role based interface is particularly important because enrollment and attendence marking require different privileges and different interface priorities.

From a practical standpoint, the strongest aspect of the project is integration. Many academic projects stop at recognizing a face and printing a name. This repository goes further by connecting recognition with subject mapping, duplicate control, report generation, and email distribution. That integration is what makes the system closer to a deployable college application.

At the same time, the current implementation still has limitations. Recognition quality depends heavily on lighting, image angle, occlusion, and the number of enrollment images per student. The threshold of $0.9$ is useful in the present codebase, but it may require adjustment under different camera conditions. Alternative embedding approaches such as ArcFace \cite{b8} and deeper residual backbone architectures \cite{b16} could improve matching accuracy. A formal evaluation on standard benchmarks such as Labeled Faces in the Wild \cite{b10} would provide a more rigorous performance baseline. The monthly report currently assumes a fixed number of classes for percentage calculation, which should ideally be replaced by timetable aware logic derived from actual subject schedules.

Additional improvements may include liveness detection, multi camera capture, department wise filtering, richer analytics, attendance correction workflows, and dashboard graphs for long term trend analysis. Another valuable enhancement would be a more formal evaluation phase that reports precision, recall, or false acceptance rate on a controlled dataset.

\section{Implementation Challenges and Future Scope}
Building a real world attendence application introduces engineering issues that are often not visible in small prototypes. One challenge is the management of image quality during registration. If only one photo is captured or if the image is poorly lit, recognition performance in later classroom scenes may degrade. The project therefore benefits from capturing multiple photos from slightly different angles during enrollment.

Another challenge is operational robustness. Subject selection, schedule mapping, and email delivery are all peripheral to recognition, but they strongly affect usability. A system that recognizes faces but fails to attach them to the correct class is not useful in practice. The same is true for reports that are generated but not delivered reliably. For this reason, the repository includes both a time based schedule mode and a manual subject selection mode.

Future work can extend the project in several directions. A stronger attendance analytics module could show low attendance risk students, subject wise trends, and faculty summaries. A dedicated timetable entity could replace fixed assumptions in the monthly report. Security could be improved through stronger session management and administrative approval of new accounts. Recognition could be improved by storing more training images or by evaluating alternative embedding models.

\section{Conclusion}
This paper presented an expanded description of the repository based Automated Attendence System Using Facial Recognition. The system combines facial recognition, webcam based student enrollment, role based web access, PostgreSQL backed data management, automatic report generation, and email dispatch into one integrated platform. The implementation goes beyond a proof of concept by supporting actual admin and college workflows, subject wise attendence marking, duplicate prevention, and scheduled processing.

The project is well suited for academic demonstration, mini project work, and small scale college deployment where low cost automation is required. Its strongest contribution is the integration of computer vision with practical software management functions. Because the repository is modular and already operational, it also provides a strong base for future work in analytics, timetable integration, stronger security, and improved recognition performance.

\section*{Acknowledgment}
No external funding is claimed in this draft. The implementation described in this paper relies on open source libraries and tools integrated in the repository.

\section*{References}
\begin{thebibliography}{00}
\bibitem{b1} F. Schroff, D. Kalenichenko, and J. Philbin, ``FaceNet: A unified embedding for face recognition and clustering,'' in \textit{Proc. IEEE Conf. Computer Vision and Pattern Recognition (CVPR)}, 2015, pp. 815--823.
\bibitem{b2} K. Zhang, Z. Zhang, Z. Li, and Y. Qiao, ``Joint face detection and alignment using multitask cascaded convolutional networks,'' \textit{IEEE Signal Processing Letters}, vol. 23, no. 10, pp. 1499--1503, 2016.
\bibitem{b3} O. M. Parkhi, A. Vedaldi, and A. Zisserman, ``Deep face recognition,'' in \textit{Proc. British Machine Vision Conference (BMVC)}, 2015.
\bibitem{b4} S. I. Serengil, ``DeepFace: A lightweight face recognition and facial attribute analysis framework,'' GitHub repository. [Online]. Available: \url{https://github.com/serengil/deepface}
\bibitem{b5} G. Bradski, ``The OpenCV Library,'' \textit{Dr. Dobb's Journal of Software Tools}, 2000.
\bibitem{b6} PostgreSQL Global Development Group, ``PostgreSQL documentation.'' [Online]. Available: \url{https://www.postgresql.org/docs/}
\bibitem{b7} Pallets, ``Flask documentation.'' [Online]. Available: \url{https://flask.palletsprojects.com/}
\bibitem{b8} J. Deng, J. Guo, N. Xue, and S. Zafeiriou, ``ArcFace: Additive angular margin loss for deep face recognition,'' in \textit{Proc. IEEE/CVF Conf. Computer Vision and Pattern Recognition (CVPR)}, 2019, pp. 4690--4699.
\bibitem{b9} Y. Taigman, M. Yang, M. Ranzato, and L. Wolf, ``DeepFace: Closing the gap to human-level performance in face verification,'' in \textit{Proc. IEEE Conf. Computer Vision and Pattern Recognition (CVPR)}, 2014, pp. 1701--1708.
\bibitem{b10} G. B. Huang, M. Ramesh, T. Berg, and E. Learned-Miller, ``Labeled faces in the wild: A database for studying face recognition in unconstrained environments,'' Univ. Massachusetts Amherst, Tech. Rep. 07-49, 2007.
\bibitem{b11} W. Zhao, R. Chellappa, P. J. Phillips, and A. Rosenfeld, ``Face recognition: A literature survey,'' \textit{ACM Computing Surveys}, vol. 35, no. 4, pp. 399--458, 2003.
\bibitem{b12} J. Deng, J. Guo, E. Ververas, I. Kotsia, and S. Zafeiriou, ``RetinaFace: Single-shot multi-level face localisation in the wild,'' in \textit{Proc. IEEE/CVF Conf. Computer Vision and Pattern Recognition (CVPR)}, 2020, pp. 5203--5212.
\bibitem{b13} M. Turk and A. Pentland, ``Eigenfaces for recognition,'' \textit{Journal of Cognitive Neuroscience}, vol. 3, no. 1, pp. 71--86, 1991.
\bibitem{b14} A. Krizhevsky, I. Sutskever, and G. E. Hinton, ``ImageNet classification with deep convolutional neural networks,'' in \textit{Advances in Neural Information Processing Systems (NeurIPS)}, vol. 25, 2012, pp. 1097--1105.
\bibitem{b15} K. Simonyan and A. Zisserman, ``Very deep convolutional networks for large-scale image recognition,'' in \textit{Proc. Int. Conf. Learning Representations (ICLR)}, 2015.
\bibitem{b16} K. He, X. Zhang, S. Ren, and J. Sun, ``Deep residual learning for image recognition,'' in \textit{Proc. IEEE Conf. Computer Vision and Pattern Recognition (CVPR)}, 2016, pp. 770--778.
\bibitem{b17} M. Abadi et al., ``TensorFlow: A system for large-scale machine learning,'' in \textit{Proc. 12th USENIX Symp. Operating Systems Design and Implementation (OSDI)}, 2016, pp. 265--283.
\bibitem{b18} F. Chollet et al., ``Keras,'' GitHub repository. [Online]. Available: \url{https://github.com/keras-team/keras}
\bibitem{b19} M. Bayer, ``SQLAlchemy,'' in \textit{The Architecture of Open Source Applications}, vol. 2, A. Brown and G. Wilson, Eds. lulu.com, 2012.
\bibitem{b20} C. R. Harris et al., ``Array programming with NumPy,'' \textit{Nature}, vol. 585, pp. 357--362, 2020.
\end{thebibliography}

\end{document}



