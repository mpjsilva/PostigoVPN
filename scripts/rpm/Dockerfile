# Contêiner Fedora só para empacotar o .rpm (o servidor é Ubuntu e não tem rpmbuild).
FROM fedora:42
RUN dnf -y install rpm-build rpmdevtools nodejs npm git libxcrypt-compat libyaml xz && dnf clean all
WORKDIR /work
